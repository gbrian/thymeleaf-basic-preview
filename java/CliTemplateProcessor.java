import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.FileTemplateResolver;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Map;
import java.util.stream.Collectors;

public class CliTemplateProcessor {

    public static void main(String[] args) {
        String templatePath = null;
        String dataPath     = null;
        boolean dataStream  = false;

        // 1. Parse Named Arguments
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--template-path":
                    if (i + 1 < args.length) templatePath = args[++i];
                    break;
                case "--data-path":
                    if (i + 1 < args.length) dataPath = args[++i];
                    break;
                case "--data-stream":
                    dataStream = true;
                    break;
                default:
                    System.err.println("Unknown argument: " + args[i]);
                    printUsage();
                    System.exit(1);
            }
        }

        // 2. Validate Argument Logic
        if (templatePath == null) {
            System.err.println("Error: --template-path is required.");
            printUsage();
            System.exit(1);
        }
        if (dataPath == null && !dataStream) {
            System.err.println("Error: You must provide either --data-path or --data-stream.");
            printUsage();
            System.exit(1);
        }
        if (dataPath != null && dataStream) {
            System.err.println("Error: Cannot use --data-path and --data-stream at the same time.");
            printUsage();
            System.exit(1);
        }

        try {
            // 3. Retrieve JSON Data String
            String jsonContent;
            if (dataStream) {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
                    jsonContent = reader.lines().collect(Collectors.joining("\n"));
                }
            } else {
                jsonContent = Files.readString(Paths.get(dataPath), StandardCharsets.UTF_8);
            }

            // 4. Parse JSON into Variables Map
            ObjectMapper objectMapper = new ObjectMapper();
            Map<String, Object> variables = objectMapper.readValue(
                    jsonContent,
                    new TypeReference<Map<String, Object>>() {}
            );

            // 5. Detect Template Mode based on file extension
            TemplateMode mode = templatePath.toLowerCase().endsWith(".html")
                    || templatePath.toLowerCase().endsWith(".htm")
                    ? TemplateMode.HTML
                    : TemplateMode.TEXT;

            // 6. Configure File Resolver & Engine
            FileTemplateResolver resolver = new FileTemplateResolver();
            resolver.setTemplateMode(mode);
            resolver.setCharacterEncoding("UTF-8");
            resolver.setCacheable(false);

            TemplateEngine templateEngine = new TemplateEngine();
            templateEngine.setTemplateResolver(resolver);

            // 7. Inject Variables and Execute
            Context context = new Context();
            context.setVariables(variables);

            String output = templateEngine.process(templatePath, context);
            System.out.print(output);

        } catch (Exception e) {
            System.err.println("Error processing execution: " + e.getMessage());
            System.exit(1);
        }
    }

    private static void printUsage() {
        System.err.println("\nUsage Options:");
        System.err.println("  --template-path <path>  Absolute path to the template file (.html or .txt)");
        System.err.println("  --data-path <path>      Absolute path to a local JSON data file");
        System.err.println("  --data-stream           Flag to read the JSON content from standard input stream");
    }
}