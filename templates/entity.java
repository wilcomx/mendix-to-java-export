package {{moduleName}};

import javax.persistence.Entity;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;

{{#imports}}
import {{qualifiedName}};
{{/imports}}

@Entity
{{#superClass}}
public class {{name}} extends {{superClassName}} implements core.Entity {
{{/superClass}}
{{^superClass}}
public class {{name}} implements core.Entity {
{{/superClass}}

	{{#attributes}}
	{{#annotation}}
	@{{name}}{{{params}}}
	{{/annotation}}
	private {{{type}}} {{name}};
	{{/attributes}}
	{{#constructorParams}}

	public {{name}}() {}

	{{/constructorParams}}
	public {{name}} ({{{constructorParams}}}) {
		{{#attributes}}
		this.{{name}} = {{name}};
		{{/attributes}}
	}

    public java.util.Date getchangedDate() {
        return new java.util.Date();
    }

	{{#attributes}}
	public {{{type}}} get{{name}}() {
		return this.{{name}};
	}
	
	public void set{{name}}({{{type}}} {{name}}) {
		this.{{name}} = {{name}};
	}
	{{/attributes}}

}
