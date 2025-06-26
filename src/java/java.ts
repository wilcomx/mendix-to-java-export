import { render } from "../render/render";

export namespace java {
    interface IJava {
        readonly javaPackage: string;
        readonly name: string;
        
        addImport(javaImport: string): void;
        setAccessModifier(accessModifier: AccessModifier): void;
        addMethod(method: JavaClassMethod): void;
    }

    abstract class AbstractJava implements IJava {
        readonly javaPackage: string;
        readonly name: string;
        protected imports: string[] = [];
        protected accessModifier: AccessModifier = AccessModifier.DEFAULT;
        protected methods: JavaClassMethod[] = [];

        constructor(name: string, javaPackage: string) {
            this.name = name;
            this.javaPackage = javaPackage;
        }
        
        addImport(javaImport: string): void {
            this.imports.push(javaImport);
        }
        
        setAccessModifier(accessModifier: AccessModifier): void {
            this.accessModifier = accessModifier;
        }

        renderPackageAndImports(): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            codeLines.push({indentIndex: 0, content: `package ${this.javaPackage};`});
            codeLines.push(render.blankLine());
            if (this.imports.length > 0) {
                this.imports.sort();
                this.imports.forEach(javaImport => {
                    codeLines.push({indentIndex: 0, content: `import ${javaImport};`});
                });
                codeLines.push(render.blankLine());
            }
            return codeLines;
        }

        addMethod(method: JavaClassMethod): void {
            if (this.hasMethod(method.name)) {
                throw `Method ${method.name} already exist in ${this.javaPackage}.${this.name}`;
            }
            this.methods.push(method);
        }

        hasMethod(name: string): boolean {
            const count = this.methods.filter(method => method.name === name).length;
            return count === 1;
        }

        abstract getDeclarationLine(): string;
    }

    export class JavaClass extends AbstractJava implements render.IRenderable {
        accessModifier: AccessModifier = AccessModifier.PUBLIC;
        isAbstract: boolean = false;
        isStatic: boolean = false;
        isFinal: boolean = false;
        isStrictfp: boolean = false;
        extends: string | null = null;
        implements: string[] = [];
        classMembers: Map<string, JavaClassMember> = new Map();

        constructor(name: string, javaPackage: string) {
            super(name, javaPackage);
        }

        addImplementsDeclaration(implementsDeclaration: string): void {
            this.implements.push(implementsDeclaration);
        }

        addClassMember(classMember: JavaClassMember): void {
            this.classMembers.set(classMember.name, classMember);
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = this.renderPackageAndImports();
            codeLines.push({indentIndex: indentIndex, content: this.getDeclarationLine()});
            if (this.classMembers.size > 0) {
                this.classMembers.forEach(classMember => codeLines = codeLines.concat(classMember.render(indentIndex + 1)));
                // for (let entry of this.classMembers) {
                //     const classMember: JavaClassMember = entry["1"];
                //     codeLines = codeLines.concat(classMember.render(indentIndex + 1))
                // }
                codeLines.push(render.blankLine());
            }
            if (this.methods.length > 0) {
                this.methods.forEach(method => {
                    codeLines = codeLines.concat(method.render(indentIndex + 1)); 
                    codeLines.push(render.blankLine());
                });
            }
            codeLines.push({indentIndex: indentIndex, content: '}'});
            return codeLines;
        }

        getDeclarationLine(): string {
            let declarationLine: string = '';
            if (this.accessModifier !== AccessModifier.DEFAULT) {
                declarationLine += this.accessModifier + ' ';
            }
            if (this.isAbstract) { declarationLine += 'abstract '; }
            if (this.isStatic) { declarationLine += 'static '; }
            if (this.isFinal) { declarationLine += 'final '; }
            if (this.isStrictfp) { declarationLine += 'strictfp '; }
            declarationLine += `class ${this.name} `;
            if (this.extends) {
                declarationLine += `extends ${this.extends} `;
            }
            if (this.implements.length > 0) {
                declarationLine += `implements ${this.implements.join(', ')} `;
            }
            return `${declarationLine}{`;
        }
    }

    export class JavaInterface extends AbstractJava implements render.IRenderable {
        constructor(name: string, javaPackage: string) {
            super(name, javaPackage);
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = this.renderPackageAndImports();
            codeLines.push({indentIndex: 0, content: this.getDeclarationLine()});
            codeLines.push({indentIndex: 0, content: '}'});
            return codeLines;
        }

        getDeclarationLine(): string {
            let declarationLine: string = '';
            
            return '{';
        }
    }

    export class JavaClassMember implements render.IRenderable {
        accessModifier: AccessModifier = AccessModifier.DEFAULT;
        isStatic: boolean = false;
        isFinal: boolean = false;
        isTransient: boolean = false;
        isVolatile: boolean = false;
        readonly name: string;
        readonly type: string;
        readonly initialValue: string | null;

        constructor(name: string, type: string, initialValue: string | null = null) {
            this.name = name;
            this.type = type;
            this.initialValue = initialValue;
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            let codeLine: string = '';
            if (this.accessModifier !== AccessModifier.DEFAULT) {
                codeLine += this.accessModifier + ' ';
            }
            if (this.isStatic) { codeLine += 'static '; }
            if (this.isFinal) { codeLine += 'final '; }
            if (this.isVolatile) { codeLine += 'volatile '; }
            if (this.isTransient) { codeLine += 'transient '; }
            codeLine += `${this.type} ${this.name}`
            if (this.initialValue) {
                codeLine += ` = ${this.initialValue}`;
            }
            codeLine += ';';
            codeLines.push({indentIndex: indentIndex, content: codeLine});
            return codeLines;
        }
    }

    export class JavaClassMethod implements render.IRenderable {
        accessModifier: AccessModifier = AccessModifier.DEFAULT;
        isAbstract: boolean = false;
        isStatic: boolean = false;
        isFinal: boolean = false;
        isSynchronized: boolean = false;
        isNative: boolean = false;
        isStrictfp: boolean = false;
        readonly name: string;
        readonly returnType: string;
        readonly parameters: MethodParameter[];
        readonly exceptions: string[];
        readonly codeBlock: ICodeBlock;

        constructor(name: string, returnType: string, codeBlock: ICodeBlock, parameters: MethodParameter[] = [], exceptions: string[] = []) {
            this.name = name;
            this.returnType = returnType;
            this.parameters = parameters;
            this.codeBlock = codeBlock;
            this.exceptions = exceptions;
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            let declarationLine: string = '';
            if (this.accessModifier !== AccessModifier.DEFAULT) {
                declarationLine += this.accessModifier + ' ';
            }
            if (this.isAbstract) { declarationLine += 'abstract '; }
            if (this.isStatic) { declarationLine += 'static '; }
            if (this.isFinal) { declarationLine += 'final '; }
            if (this.isSynchronized) { declarationLine += 'synchronized '; }
            if (this.isNative) { declarationLine += 'native '; }
            if (this.isStrictfp) { declarationLine += 'strictfp '; }
            declarationLine += `${this.returnType} ${this.name}(`;
            declarationLine += this.parameters.map(parameter => `${parameter.final ? 'final ' : ''}${parameter.type} ${parameter.name}`).join(', ');
            declarationLine += ') ';
            if (this.exceptions.length > 0) {
                declarationLine += this.exceptions.join(', ') + ' ';
            }
            declarationLine += '{';
            codeLines.push({indentIndex: indentIndex, content: declarationLine});
            codeLines = codeLines.concat(this.codeBlock.render(indentIndex + 1));
            codeLines.push({indentIndex: indentIndex, content: '}'});
            return codeLines;
        }
    }

    export interface ICodeBlockItem extends render.IRenderable {}

    export interface ICodeBlock extends render.IRenderable {
        readonly parentCodeBlock: ICodeBlock | null;
        readonly returnType: string | null;

        addVariable(variable: java.Variable): void;
        hasVariable(name: string): boolean;
        getVariableType(name: string): string;
        addCodeBlockItem(codeBlockItem: ICodeBlockItem): void;
        getItemCount(): number;
    }

    export abstract class AbstractCodeBlock implements ICodeBlock {
        protected variables: Map<string, java.Variable> = new Map<string, java.Variable>();
        protected codeBlockItems: ICodeBlockItem[] = [];
        readonly parentCodeBlock: ICodeBlock | null;
        readonly returnType: string | null;

        constructor(parent: ICodeBlock | null, returnType: string | null) {
            this.parentCodeBlock = parent;
            this.returnType = returnType;
        }

        addVariable(variable: java.Variable): void {
            this.variables.set(variable.name, variable);
        }
        hasVariable(name: string): boolean {
            return name in this.variables || (this.parentCodeBlock !== null && this.parentCodeBlock.hasVariable(name));
        }
        getVariableType(name: string): string {
            const variable = this.variables.get(name);
            if (variable !== undefined) {
                return variable.type;
            }
            throw `No variable found with name: ${name}`;
        }
        addCodeBlockItem(codeBlockItem: ICodeBlockItem) {
            this.codeBlockItems.push(codeBlockItem);
        }
        getItemCount(): number {
            return this.codeBlockItems.length;
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            this.variables.forEach(variable => codeLines.push(
                {indentIndex: indentIndex + 1, content: `${variable.type} ${variable.name}`}
            ));
            if (this.variables.size > 0) {
                codeLines.push(render.blankLine());
            }
            this.codeBlockItems.forEach(codeBlockItem => codeLines = codeLines.concat(codeBlockItem.render(indentIndex)));
            return codeLines
        }
    }

    export interface Variable {
        name: string;
        type: string;
    }

    export interface MethodParameter extends Variable {
        final: boolean;
    }

    export enum AccessModifier {
        PUBLIC = 'public',
        PRIVATE = 'private',
        PROTECTED = 'protected',
        DEFAULT = 'default'
    }

    export class SingleStatement implements ICodeBlockItem {
        readonly statement: string;

        constructor(statement: string) {
            this.statement = statement;
        }

        render(indentIndex: number): render.CodeLine[] {
            return [{indentIndex: indentIndex, content: this.statement}];
        }
    }

    export class MultiStatement implements ICodeBlockItem {
        readonly statements: string[] = [];

        addStatement(statement: string) {
            this.statements.push(statement);
        }

        render(indentIndex: number): render.CodeLine[] {
            let statements: render.CodeLine[] = [];
            this.statements.forEach(statement => statements.push({indentIndex: indentIndex, content: statement}));
            return statements;
        }
    }
}
