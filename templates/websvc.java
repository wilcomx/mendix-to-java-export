package {{pkg}};

public class {{name}} {
	{{#operations}}

	public static <T> T {{name}}({{{parameterList}}}) {
		throw new RuntimeException("Not yet implemented");
	}
	{{/operations}}

}
