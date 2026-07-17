import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.exceptions.TemplateEngineException;
import org.thymeleaf.exceptions.TemplateProcessingException;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.FileTemplateResolver;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

public class CliTemplateProcessor {

	public static void main(final String[] args) {
		final var processor = new CliTemplateProcessor();
		final var parsedArgs = processor.parseArguments(args);
		processor.validateArguments(parsedArgs);

		try {
			final var jsonContent = processor.readJsonContent(parsedArgs);
			final var output = processor.processTemplate(parsedArgs.templatePath(), jsonContent, parsedArgs.messagesPath());
			System.out.print(output);
			System.exit(0);
		} catch (final Exception exception) {
			processor.printDetailedError(exception);
			System.exit(1);
		}
	}

	public void printDetailedError(final Exception exception) {
		System.err.println("═══════════════════════════════════════════════════════════════");
		System.err.println("ERROR DETAILS:");
		System.err.println("═══════════════════════════════════════════════════════════════");
		System.err.println("Exception Type: " + exception.getClass().getName());
		System.err.println("Message: " + exception.getMessage());

		if (exception instanceof TemplateProcessingException) {
			this.printTemplateProcessingErrorDetails((TemplateProcessingException) exception);
		}

		if (exception.getCause() != null) {
			System.err.println("\nROOT CAUSE:");
			final var cause = exception.getCause();
			System.err.println("Type: " + cause.getClass().getName());
			System.err.println("Message: " + cause.getMessage());

			if (cause.getCause() != null) {
				System.err.println("\nUNDERLYING CAUSE:");
				final var underlyingCause = cause.getCause();
				System.err.println("Type: " + underlyingCause.getClass().getName());
				System.err.println("Message: " + underlyingCause.getMessage());
			}
		}

		System.err.println("\nSTACK TRACE:");
		System.err.println("═══════════════════════════════════════════════════════════════");
		exception.printStackTrace(System.err);

		if (exception.getCause() != null) {
			System.err.println("\nCAUSE STACK TRACE:");
			System.err.println("═══════════════════════════════════════════════════════════════");
			exception.getCause().printStackTrace(System.err);
		}

		System.err.println("═══════════════════════════════════════════════════════════════");
	}

	public CliArguments parseArguments(final String[] args) {
		String templatePath = null;
		String dataPath = null;
		String messagesPath = null;
		boolean dataStream = false;

		for (int index = 0; index < args.length; index++) {
			switch (args[index]) {
				case "--template-path":
					if (index + 1 < args.length) {
						templatePath = args[++index];
					}
					break;
				case "--data-path":
					if (index + 1 < args.length) {
						dataPath = args[++index];
					}
					break;
				case "--messages-path":
					if (index + 1 < args.length) {
						messagesPath = args[++index];
					}
					break;
				case "--data-stream":
					dataStream = true;
					break;
				default:
					System.err.println("Unknown argument: " + args[index]);
					this.printUsage();
					System.exit(1);
			}
		}

		return new CliArguments(templatePath, dataPath, messagesPath, dataStream);
	}

	public void validateArguments(final CliArguments arguments) {
		if (arguments.templatePath() == null) {
			System.err.println("Error: --template-path is required.");
			this.printUsage();
			System.exit(1);
		}
		if (arguments.dataPath() == null && !arguments.dataStream()) {
			System.err.println("Error: You must provide either --data-path or --data-stream.");
			this.printUsage();
			System.exit(1);
		}
		if (arguments.dataPath() != null && arguments.dataStream()) {
			System.err.println("Error: Cannot use --data-path and --data-stream at the same time.");
			this.printUsage();
			System.exit(1);
		}
	}

	public String readJsonContent(final CliArguments arguments) throws Exception {
		if (arguments.dataStream()) {
			try (final var reader = new BufferedReader(
					new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
				return reader.lines().collect(Collectors.joining("\n"));
			}
		}
		return Files.readString(Paths.get(arguments.dataPath()), StandardCharsets.UTF_8);
	}

	public String processTemplate(
			@NotBlank final String templatePath,
			@NotBlank final String jsonContent,
			final String messagesPath
	) throws Exception {
		try {
			final var variables = this.parseJsonToVariables(jsonContent);
			final var messages = this.loadMessages(templatePath, messagesPath);
			variables.put("messages", new ThymeleafMessageResolver(messages));
			final var templateMode = this.resolveTemplateMode(templatePath);
			final var templateEngine = this.buildTemplateEngine(templateMode);
			final var context = this.buildContext(variables);
			return templateEngine.process(templatePath, context);
		} catch (final TemplateEngineException engineException) {
			throw new Exception("Template processing failed: " + engineException.getMessage(), engineException);
		}
	}

	public void printUsage() {
		System.err.println("\nUsage Options:");
		System.err.println("  --template-path <path>   Absolute path to the template file (.html or .txt)");
		System.err.println("  --data-path <path>       Absolute path to a local JSON data file");
		System.err.println("  --messages-path <path>   Optional: absolute path to a .properties file for i18n messages");
		System.err.println("  --data-stream            Flag to read the JSON content from standard input stream");
	}

	private void printTemplateProcessingErrorDetails(
			@NotNull final TemplateProcessingException processingException
	) {
		System.err.println("\nTEMPLATE PROCESSING ERROR DETAILS:");
		System.err.println("───────────────────────────────────────────────────────────────");

		final var templateName = processingException.getTemplateName();
		if (templateName != null && !templateName.isBlank()) {
			System.err.println("Template: " + templateName);
		}

		final var lineNumber = processingException.getLine();
		final var colNumber = processingException.getCol();

		if (lineNumber != null && lineNumber > 0) {
			System.err.println("Line: " + lineNumber);
		}
		if (colNumber != null && colNumber > 0) {
			System.err.println("Column: " + colNumber);
		}

		System.err.println("───────────────────────────────────────────────────────────────");
	}

	private Map<String, Object> parseJsonToVariables(@NotBlank final String jsonContent) throws Exception {
		try {
			final var objectMapper = new ObjectMapper();
			return objectMapper.readValue(jsonContent, new TypeReference<Map<String, Object>>() {});
		} catch (final Exception parseException) {
			throw new Exception("Failed to parse JSON data: " + parseException.getMessage(), parseException);
		}
	}

	private Map<String, String> loadMessages(
			@NotBlank final String templatePath,
			final String messagesPath
	) {
		if (messagesPath != null && !messagesPath.isBlank()) {
			return this.loadMessagesFromExplicitPath(messagesPath);
		}
		return this.loadMessagesFromTemplatePath(templatePath);
	}

	private Map<String, String> loadMessagesFromExplicitPath(@NotBlank final String messagesPath) {
		try {
			return this.loadPropertiesFile(messagesPath);
		} catch (final Exception exception) {
			System.err.println("Warning: Could not load messages from explicit path " + messagesPath + ": " + exception.getMessage());
			return new HashMap<>();
		}
	}

	private Map<String, String> loadMessagesFromTemplatePath(@NotBlank final String templatePath) {
		final var templateBase = templatePath.replaceAll("\\.[^.]+$", "");
		final var messagesFile = templateBase + ".properties";

		try {
			return this.loadPropertiesFile(messagesFile);
		} catch (final Exception exception) {
			System.err.println("Warning: Could not load messages from " + messagesFile + ": " + exception.getMessage());
			return new HashMap<>();
		}
	}

	private Map<String, String> loadPropertiesFile(@NotBlank final String filePath) throws Exception {
		final var result = new HashMap<String, String>();
		final var path = Paths.get(filePath);

		if (!Files.exists(path)) {
			return result;
		}

		final var lines = Files.readAllLines(path, StandardCharsets.UTF_8);
		for (final var line : lines) {
			final var trimmed = line.trim();
			if (trimmed.isEmpty() || trimmed.startsWith("#")) {
				continue;
			}
			final var eqIndex = trimmed.indexOf('=');
			if (eqIndex == -1) {
				continue;
			}
			final var key = trimmed.substring(0, eqIndex).trim();
			final var value = trimmed.substring(eqIndex + 1).trim();
			result.put(key, value);
		}

		return result;
	}

	private TemplateMode resolveTemplateMode(@NotBlank final String templatePath) {
		final var lowerPath = templatePath.toLowerCase();
		final var isHtml = lowerPath.endsWith(".html") || lowerPath.endsWith(".htm");
		return isHtml ? TemplateMode.HTML : TemplateMode.TEXT;
	}

	private TemplateEngine buildTemplateEngine(@NotNull final TemplateMode templateMode) {
		final var resolver = new FileTemplateResolver();
		resolver.setTemplateMode(templateMode);
		resolver.setCharacterEncoding("UTF-8");
		resolver.setCacheable(false);

		final var engine = new TemplateEngine();
		engine.setTemplateResolver(resolver);
		return engine;
	}

	private Context buildContext(@NotNull final Map<String, Object> variables) {
		final var context = new Context();
		context.setVariables(variables);
		return context;
	}

	private record CliArguments(String templatePath, String dataPath, String messagesPath, boolean dataStream) {}
}