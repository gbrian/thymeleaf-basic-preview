import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public class ThymeleafMessageResolver {
	
	private final Map<String, String> messages;

	public ThymeleafMessageResolver(@NotNull final Map<String, String> messages) {
		this.messages = messages;
	}

	public String msg(@NotBlank final String key) {
		return this.messages.getOrDefault(key, key);
	}
}