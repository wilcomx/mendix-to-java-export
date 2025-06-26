package {{pkg}};

public class {{name}} {
	{{#entities}}

	public class {{name}} {
		{{#attributes}}
		{{{attribute}}}
		{{/attributes}}

		{{#gettersAndSetters}}
			
			public {{{type}}} get{{name}}() {
				return this.{{name}};
			}
			public void set{{name}}({{{type}}} {{name}}) {
				this.{{name}} = {{name}};
			}

		{{/gettersAndSetters}}
	}
	{{/entities}}
	{{#actions}}

	public static {{{returnType}}} {{name}}({{{paramList}}}) {
		throw new RuntimeException("Not yet implemented");
	}
	{{/actions}}
	

}
