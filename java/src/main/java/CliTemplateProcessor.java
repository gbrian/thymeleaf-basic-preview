import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.FileTemplateResolver;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Map;
import java.util.stream.Collectors;

public class CliTemplateProcessor {

    public static void main(final String[] args) {
        final var parsedArgs = parseArguments(args);
        validateArguments(parsedArgs);

        try {
            final var jsonContent = readJsonContent(parsedArgs);
            final var output = processTemplate(parsedArgs.templatePath(), jsonContent);
            System.out.print(output);
            System.exit(0);
        } catch (Exception exception) {
            System.err.println("Error processing execution: " + exception.getMessage());
            System.exit(1);
        }
    }

    private static CliArguments parseArguments(final String[] args) {
        String templatePath = null;
        String dataPath = null;
        boolean dataStream = false;

        for (int index = 0; index < args.length; index++) {
            switch (args[index]) {
                case "--template-path":
                    if (index + 1 < args.length) templatePath = args[++index];
                    break;
                case "--data-path":
                    if (index + 1 < args.length) dataPath = args[++index];
                    break;
                case "--data-stream":
                    dataStream = true;
                    break;
                default:
                    System.err.println("Unknown argument: " + args[index]);
                    printUsage();
                    System.exit(1);
            }
        }

        return new CliArguments(templatePath, dataPath, dataStream);
    }

    private static void validateArguments(final CliArguments arguments) {
        if (arguments.templatePath() == null) {
            System.err.println("Error: --template-path is required.");
            printUsage();
            System.exit(1);
        }
        if (arguments.dataPath() == null && !arguments.dataStream()) {
            System.err.println("Error: You must provide either --data-path or --data-stream.");
            printUsage();
            System.exit(1);
        }
        if (arguments.dataPath() != null && arguments.dataStream()) {
            System.err.println("Error: Cannot use --data-path and --data-stream at the same time.");
            printUsage();
            System.exit(1);
        }
    }

    private static String readJsonContent(final CliArguments arguments) throws Exception {
        if (arguments.dataStream()) {
            try (final var reader = new BufferedReader(
                    new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
                return reader.lines().collect(Collectors.joining("\n"));
            }
        }
        return Files.readString(Paths.get(arguments.dataPath()), StandardCharsets.UTF_8);
    }

    private static String processTemplate(
            @NotBlank final String templatePath,
            @NotBlank final String jsonContent
    ) throws Exception {
        final var variables = parseJsonToVariables(jsonContent);
        final var templateMode = resolveTemplateMode(templatePath);
        final var templateEngine = buildTemplateEngine(templateMode);
        final var context = buildContext(variables);
        return templateEngine.process(templatePath, context);
    }

    private static Map<String, Object> parseJsonToVariables(@NotBlank final String jsonContent) throws Exception {
        final var objectMapper = new ObjectMapper();
        return objectMapper.readValue(jsonContent, new TypeReference<Map<String, Object>>() {});
    }

    private static TemplateMode resolveTemplateMode(@NotBlank final String templatePath) {
        final var lowerPath = templatePath.toLowerCase();
        final var isHtml = lowerPath.endsWith(".html") || lowerPath.endsWith(".htm");
        return isHtml ? TemplateMode.HTML : TemplateMode.TEXT;
    }

    private static TemplateEngine buildTemplateEngine(@NotNull final TemplateMode templateMode) {
        final var resolver = new FileTemplateResolver();
        resolver.setTemplateMode(templateMode);
        resolver.setCharacterEncoding("UTF-8");
        resolver.setCacheable(false);

        final var engine = new TemplateEngine();
        engine.setTemplateResolver(resolver);
        return engine;
    }

    private static Context buildContext(@NotNull final Map<String, Object> variables) {
        final var context = new Context();
        context.setVariables(variables);
        return context;
    }

    private static void printUsage() {
        System.err.println("\nUsage Options:");
        System.err.println("  --template-path <path>  Absolute path to the template file (.html or .txt)");
        System.err.println("  --data-path <path>      Absolute path to a local JSON data file");
        System.err.println("  --data-stream           Flag to read the JSON content from standard input stream");
    }

    private record CliArguments(String templatePath, String dataPath, boolean dataStream) {}
}