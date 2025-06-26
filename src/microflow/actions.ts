import { microflows, domainmodels, IModel } from "mendixmodelsdk";
import { render } from "../render/render"; 
import { javautils as ju } from '../java/utils';
import { java } from '../java/java';
import { microflow } from './microflow';
import { microflowactivities as activities } from './activities';
import { exit } from "process";

export namespace microflowactions {
    export abstract class AbstractAction extends activities.AbstractActivity {
        protected variableAssignmentType: string | null = null;
        protected variableAssignmentName: string | null = null;
        protected useVariable: boolean = true;
        
        abstract renderAction(indentIndex: number): render.CodeLine[];

        render(indentIndex: number): render.CodeLine[] {
            if (this.errorCodeBlock) {
                let codeLines: render.CodeLine[] = [];
                codeLines.push({indentIndex: indentIndex, content: 'try {'});
                codeLines = codeLines.concat(this.renderAction(indentIndex + 1));
                codeLines.push({indentIndex: indentIndex, content: '} catch (Exception ex) {'});
                codeLines = codeLines.concat(this.errorCodeBlock.render(indentIndex + 1));
                codeLines.push({indentIndex: indentIndex, content: '}'});
                return codeLines;
            }
            return this.renderAction(indentIndex);
        }

        getVariableAssignment(): java.Variable | null {
            if (this.useVariable && this.variableAssignmentName !== null && this.variableAssignmentType !== null) {
                return {name: this.variableAssignmentName, type: this.variableAssignmentType};
            }
            return null;
        }

        setErrorCodeBlock(errorCodeBlock: microflow.IMicroflowCodeBlock): void {
            this.errorCodeBlock = errorCodeBlock;
        }
    }

    // Object actions
    export class CastAction extends AbstractAction {
        readonly castAction: microflows.CastAction;
        readonly inheritanceCodeBlock: microflow.InheritanceCodeBlock;

        constructor(castAction: microflows.CastAction, inheritanceCodeBlock: microflow.InheritanceCodeBlock) {
            super();
            this.castAction = castAction;
            this.inheritanceCodeBlock = inheritanceCodeBlock;
            this.prepare();
        }

        private prepare(): void {
            this.variableAssignmentType = this.inheritanceCodeBlock.inheritedVariable.type;
            this.variableAssignmentName = ju.parseName(this.castAction.outputVariableName, ju.JavaName.MEMBER);
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let line: string = `${this.variableAssignmentName} = (${this.variableAssignmentType})${this.inheritanceCodeBlock.inheritedVariable.name};`;
            return [{indentIndex: indentIndex, content: line}];
        }
    }

    export class ChangeObjectAction extends AbstractAction {
        readonly changeObjectAction: microflows.ChangeObjectAction;
        readonly model: IModel;

        constructor(changeObjectAction: microflows.ChangeObjectAction, model: IModel) {
            super();
            this.changeObjectAction = changeObjectAction;
            this.model = model;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            const variableName: string = ju.parseName(this.changeObjectAction.changeVariableName, ju.JavaName.MEMBER);
            this.changeObjectAction.items.forEach(memberChange => {
                let methodName: string;
                if (memberChange.attributeQualifiedName) {
                    methodName = ju.getNameFromString(memberChange.attributeQualifiedName);
                } else if (memberChange.associationQualifiedName) {
                    methodName = ju.getNameFromString(memberChange.associationQualifiedName);
                } else {
                    throw `MemberChange without association or attribute: ${memberChange.id}`
                }
    
                var newValue = ju.parseMxExpression(memberChange.value, this.model);
                if (memberChange.attribute && memberChange.attribute instanceof domainmodels.EnumerationAttributeType) { // TODO: this does not work
                    newValue = newValue.replace('.', '.enumeration.');
                    throw `Unimplemented enumeration attribute type in change object action`;
                }
                codeLines.push({indentIndex: indentIndex, content: `${variableName}.set${methodName}(${newValue});`});
            });
            if (this.changeObjectAction.refreshInClient) {
                codeLines.push({indentIndex: indentIndex, content: `core.MXClient.refresh(${variableName});`});
            }
            if (this.changeObjectAction.commit == microflows.CommitEnum.Yes) {
                codeLines.push({indentIndex: indentIndex, content: `core.MXCore.commit(${variableName});`});
            }
            if (this.changeObjectAction.commit == microflows.CommitEnum.YesWithoutEvents) {
                codeLines.push({indentIndex: indentIndex, content: `core.MXCore.commitWithoutEvents(${variableName});`});
            }
            return codeLines;
        }
    }

    export class CommitAction extends AbstractAction {
        readonly commitAction: microflows.CommitAction;

        constructor(commitAction: microflows.CommitAction) {
            super();
            this.commitAction = commitAction;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            const variableName: string = ju.parseName(this.commitAction.commitVariableName, ju.JavaName.MEMBER);
            codeLines.push({indentIndex: indentIndex, content: `core.MXCore.commit(${variableName}, ${this.commitAction.withEvents ? 'true' : 'false'});`});
            
            if (this.commitAction.refreshInClient) {
                codeLines.push({indentIndex: indentIndex, content: `core.MXClient.refresh(${variableName});`});
            }
            return codeLines;
        }
    }

    export class CreateObjectAction extends AbstractAction {
        readonly createObjectAction: microflows.CreateObjectAction;
        readonly model: IModel;

        constructor(createObjectAction: microflows.CreateObjectAction, model: IModel) {
            super();
            this.createObjectAction = createObjectAction;
            this.model = model;
            this.prepare();
        }

        private prepare() {
            if (this.createObjectAction.entityQualifiedName) {
                this.variableAssignmentType = ju.getQualifiedNameEntityFromString(this.createObjectAction.entityQualifiedName);
                this.variableAssignmentName = ju.parseName(this.createObjectAction.outputVariableName, ju.JavaName.MEMBER);
            }
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            codeLines.push({indentIndex: indentIndex, content: `${this.variableAssignmentName} = new ${this.variableAssignmentType}();`});
            const setters = this.createObjectAction.items.forEach(memberChange => {
                let methodName: string;
                if (memberChange.attributeQualifiedName) {
                    methodName = ju.getNameFromString(memberChange.attributeQualifiedName);
                } else if (memberChange.associationQualifiedName) {
                    methodName = ju.getNameFromString(memberChange.associationQualifiedName);
                } else {
                    throw `MemberChange without association or attribute: ${memberChange.id}`
                }
                codeLines.push({indentIndex: indentIndex, content: `${this.variableAssignmentName}.set${methodName}(${ju.parseMxExpression(memberChange.value, this.model) });`});
            });
            return codeLines;
        }
    }
    
    export class DeleteAction extends AbstractAction {
        readonly deleteAction: microflows.DeleteAction;

        constructor(deleteAction: microflows.DeleteAction) {
            super();
            this.deleteAction = deleteAction;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            const variableName: string = ju.parseName(this.deleteAction.deleteVariableName, ju.JavaName.MEMBER);
            if (this.deleteAction.refreshInClient) {
                codeLines.push({indentIndex: indentIndex, content: `core.MXClient.refresh(${variableName});`});
            }
            codeLines.push({indentIndex: indentIndex, content: `core.MXCore.delete(${variableName});`});
            codeLines.push({indentIndex: indentIndex, content: variableName + ' = null;'});
            return codeLines;
        }
    }

    export class RetrieveAction extends AbstractAction {
        readonly retrieveAction: microflows.RetrieveAction;
        readonly retrieveSource: microflows.RetrieveSource;
        readonly model: IModel;
        private assignment: string = '';

        constructor(retrieveAction: microflows.RetrieveAction, model: IModel) {
            super();
            this.retrieveAction = retrieveAction;
            this.retrieveSource = retrieveAction.retrieveSource;
            this.model = model;
            this.prepare();
        }

        private prepare() {
            let isList: boolean = false;
            if (this.retrieveSource instanceof microflows.AssociationRetrieveSource) {
                if (this.retrieveSource.association === null || this.retrieveSource.associationQualifiedName === null) {
                    throw  `No association set/found for ${this.retrieveSource.id}`;
                }
                if (this.retrieveSource.associationQualifiedName.startsWith('System.')) {
                    throw `No implementation for handling system associations/entities`;
                }
                this.assignment = ju.parseName(this.retrieveSource.startVariableName, ju.JavaName.MEMBER) + '.get' + ju.getNameFromString(this.retrieveSource.associationQualifiedName) + '();';

                const association = this.retrieveSource.association;
                if (association.type === domainmodels.AssociationType.ReferenceSet) {
                    isList = true;
                } else if (association.type === domainmodels.AssociationType.Reference) {
                    isList = false;
                } else {
                    throw `Unimplemented association type ${association.type.name}`;
                }

                if (association instanceof domainmodels.CrossAssociation && association.child.qualifiedName !== null) {
                    this.variableAssignmentType = ju.getQualifiedNameEntityFromString(association.child.qualifiedName);
                } else if (association instanceof domainmodels.Association && association.child.qualifiedName !== null) {
                    this.variableAssignmentType = ju.getQualifiedNameEntityFromString(association.child.qualifiedName);
                }
            } else if (this.retrieveSource instanceof microflows.DatabaseRetrieveSource) {
                if (this.retrieveSource.entityQualifiedName === null) {
                    throw  `No entity set/found for ${this.retrieveSource.id}`;
                }
                this.variableAssignmentType = ju.getQualifiedNameEntityFromString(this.retrieveSource.entityQualifiedName);
                const range = this.retrieveSource.range;
                let constraint: string = this.retrieveSource.xPathConstraint.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ');
                let limit: string = 'null';
                let offset: string = 'null';
                if (range instanceof microflows.CustomRange) {
                    isList = true;
                    if (range.limitExpression !== '') {
                        limit = ju.parseMxExpression(range.limitExpression, this.model);
                    }
                    if (range.offsetExpression !== '') {
                        offset = ju.parseMxExpression(range.offsetExpression, this.model);
                    }
                } else if (range instanceof microflows.ConstantRange) {
                    isList = !range.singleObject
                }
                this.assignment = `core.MXData.retrieveByXPath(${this.variableAssignmentType}.class, "${constraint}", ${limit}, ${offset})${isList ? '' : '.get(0)'};`;
            } else {
                throw `No handling implemented for retrieve source of type ${this.retrieveSource.structureTypeName}`;
            }
            if (isList) {
                this.variableAssignmentType = `java.util.List<${this.variableAssignmentType}>`;
            }
            this.variableAssignmentName = ju.parseName(this.retrieveAction.outputVariableName, ju.JavaName.MEMBER);
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            return [{indentIndex: indentIndex, content: `${this.variableAssignmentName} = ${this.assignment}`}];
        }
    }

    export class RollbackAction extends AbstractAction {
        renderAction(indentIndex: number): render.CodeLine[] {
            return [{indentIndex: indentIndex, content: 'core.MXCore.rollBack();'}]
        }
    }

    // List actions

    export class AggregateListAction extends AbstractAction {
        readonly aggregateListAction: microflows.AggregateListAction;
        readonly model: IModel;

        constructor(aggregateListAction: microflows.AggregateListAction, model: IModel) {
            super();
            this.aggregateListAction = aggregateListAction;
            this.model = model;
            this.prepare();
        }

        private prepare(): void {
            this.variableAssignmentType = 'double';
            if (this.aggregateListAction.aggregateFunction === microflows.AggregateFunctionEnum.Count) {
                this.variableAssignmentType = 'long';
            }
            this.variableAssignmentName = ju.parseName(this.aggregateListAction.outputVariableName, ju.JavaName.MEMBER);
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            const aggregateFunction: string = this.aggregateListAction.aggregateFunction.name.toLowerCase();
            const codeLine: string = `${this.variableAssignmentName} = ${ju.parseName(this.aggregateListAction.inputListVariableName, ju.JavaName.MEMBER)}.stream().${aggregateFunction === 'count' ? '' : 'mapToDouble(value => value.get' + this.aggregateListAction.attribute + '()).'}${aggregateFunction}();`
            return [{indentIndex: indentIndex, content: codeLine}];
        }
    }

    export class ChangeListAction extends AbstractAction {
        readonly changeListAction: microflows.ChangeListAction;
        readonly model: IModel;

        constructor(changeListAction: microflows.ChangeListAction, model: IModel) {
            super();
            this.changeListAction = changeListAction;
            this.model = model;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            const codeLine: string = `${ju.parseName(this.changeListAction.changeVariableName, ju.JavaName.MEMBER)}.${this.changeListAction.type.name.toLowerCase() }(${ju.parseMxExpression(this.changeListAction.value, this.model) });`;
            return [{indentIndex: indentIndex, content: codeLine}];
        }
    }

    export class CreateListAction extends AbstractAction {
        readonly createListAction: microflows.CreateListAction;
        readonly model: IModel;
        private entityType: string = '';

        constructor(createListAction: microflows.CreateListAction, model: IModel) {
            super();
            this.createListAction = createListAction;
            this.model = model;
            this.prepare();
        }

        private prepare(): void {
            this.variableAssignmentName = ju.parseName(this.createListAction.outputVariableName, ju.JavaName.MEMBER);
            if (this.createListAction.entityQualifiedName === null) {
                throw `No entity set or found for list creation action ${this.createListAction.id}`;
            }
            this.entityType = ju.getQualifiedNameEntityFromString(this.createListAction.entityQualifiedName);
            this.variableAssignmentType = `java.util.List<${this.entityType}>`;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            const codeLine: string = `${ju.parseName(this.createListAction.outputVariableName, ju.JavaName.MEMBER)} = new java.util.ArrayList<${this.entityType}>();`;
            return [{indentIndex: indentIndex, content: codeLine}];
        }
    }

    export class ListOperationAction extends AbstractAction {
        readonly listOperationAction: microflows.ListOperationAction;
        readonly model: IModel;
        private microflowClass: microflow.MicroflowClass;
        private codeLines: string[] = [];

        constructor(listOperationAction: microflows.ListOperationAction, model: IModel, microflowClass: microflow.MicroflowClass) {
            super();
            this.listOperationAction = listOperationAction;
            this.model = model;
            this.microflowClass = microflowClass;
            this.prepare();
        }

        private prepare(): void {
            this.variableAssignmentName = ju.parseName(this.listOperationAction.outputVariableName, ju.JavaName.MEMBER);
            const listOperation: microflows.ListOperation | null = this.listOperationAction.operation;
            if (listOperation === null) {
                throw `No list operation specified`;
            }
            if (listOperation instanceof microflows.Union) {
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                this.variableAssignmentType = this.getVariableType(listVariableName);
                const secondListOrObjectVariableName = ju.parseName(listOperation.secondListOrObjectVariableName, ju.JavaName.MEMBER);
                const secondListOrObjectVariableType = this.getVariableType(secondListOrObjectVariableName);
                this.codeLines.push(`${listVariableName}.${this.isList(secondListOrObjectVariableType) ? 'addAll' : 'add'}(${secondListOrObjectVariableName});`);
                this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName};`);
            } else if (listOperation instanceof microflows.Intersect) {
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                this.variableAssignmentType = this.getVariableType(listVariableName);
                const secondListOrObjectVariableName = ju.parseName(listOperation.secondListOrObjectVariableName, ju.JavaName.MEMBER);
                const secondListOrObjectVariableType = this.getVariableType(secondListOrObjectVariableName);
                if (this.isList(secondListOrObjectVariableType)) {
                    this.codeLines.push(`${this.variableAssignmentName}.retainAll(${secondListOrObjectVariableName});`);
                } else {
                    this.codeLines.push(`${this.variableAssignmentName}.retainAll(java.util.Arrays.asList(${secondListOrObjectVariableName});`);
                }
                this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName};`);
            } else if (listOperation instanceof microflows.Subtract) {
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                this.variableAssignmentType = this.getVariableType(listVariableName);
                const secondListOrObjectVariableName = ju.parseName(listOperation.secondListOrObjectVariableName, ju.JavaName.MEMBER);
                const secondListOrObjectVariableType = this.getVariableType(secondListOrObjectVariableName);
                this.codeLines.push(`${listVariableName}.${this.isList(secondListOrObjectVariableType) ? 'removeAll' : 'remove'}(${secondListOrObjectVariableName});`);
                this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName};`);
            } else if (listOperation instanceof microflows.Contains) {
                this.variableAssignmentType = 'Boolean';
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                const secondListOrObjectVariableName = ju.parseName(listOperation.secondListOrObjectVariableName, ju.JavaName.MEMBER);
                const secondListOrObjectVariableType = this.getVariableType(secondListOrObjectVariableName);
                this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName}.${this.isList(secondListOrObjectVariableType) ? 'containsAll' : 'contains'}(${secondListOrObjectVariableName});`);
            } else if (listOperation instanceof microflows.ListEquals) {
                this.variableAssignmentType = 'Boolean';
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                const secondListOrObjectVariableName = ju.parseName(listOperation.secondListOrObjectVariableName, ju.JavaName.MEMBER);
                const secondListOrObjectVariableType = this.getVariableType(secondListOrObjectVariableName);
                if (this.isList(secondListOrObjectVariableType)) {
                    this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName}.equals(${secondListOrObjectVariableName});`);
                } else {
                    this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName}.equals(java.util.Arrays.asList(${secondListOrObjectVariableName});`);
                }
            } else if (listOperation instanceof microflows.Sort) {
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                this.variableAssignmentType = this.getVariableType(listVariableName);
                const objectType: string = this.getVariableType(listVariableName, true);
                let counter: number = 1;
                this.codeLines.push(`${listVariableName}.sort(`);
                listOperation.sortItemList.items.forEach(sortItem => {
                    this.codeLines.push(`\t${counter === 1 ? 'java.util.Comparator.comparing' : '\t.thenComparing(java.util.Comparator.comparing'}(${objectType}::get${sortItem.attributeRef.attributeQualifiedName})${sortItem.sortOrder === microflows.SortOrderEnum.Descending ? '.reversed()' : ''}${counter !== 1 ? ')' : ''}`);
                    counter++;
                });
                this.codeLines.push(`);`);
                this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName};`);
            } else if (listOperation instanceof microflows.Filter) {
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                this.variableAssignmentType = this.getVariableType(listVariableName);
                const property: string | null = listOperation.attributeQualifiedName !== null ? listOperation.attributeQualifiedName : listOperation.associationQualifiedName;
                this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName}.stream().filter(o -> o.get${property}() === ${ju.parseMxExpression(listOperation.expression, this.model)}).collect(java.util.stream.Collectors.toList());`);
            } else if (listOperation instanceof microflows.Find) {
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                this.variableAssignmentType = this.getVariableType(listVariableName);
                const property: string | null = listOperation.attributeQualifiedName !== null ? listOperation.attributeQualifiedName : listOperation.associationQualifiedName;
                this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName}.stream().findFirst(o -> o.get${property}() === ${ju.parseMxExpression(listOperation.expression, this.model)}).orElse(null));`);
            } else if (listOperation instanceof microflows.Head) {
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                this.variableAssignmentType = this.getVariableType(listVariableName, true);
                this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName}.size() > 0 ? ${listVariableName}.get(0) : null;`);
            } else if (listOperation instanceof microflows.Tail) {
                const listVariableName = ju.parseName(listOperation.listVariableName, ju.JavaName.MEMBER);
                this.variableAssignmentType = this.getVariableType(listVariableName);
                this.codeLines.push(`if (${listVariableName}.size() > 0) {`);
                this.codeLines.push(`\t${listVariableName}.remove(0);`);
                this.codeLines.push(`}`);
                this.codeLines.push(`${this.variableAssignmentName} = ${listVariableName};`);
            } else {
                throw `Unimplemented list operation ${listOperation.structureTypeName}`;         
            }
        }

        private getVariableType(name: string, asObject: boolean = false): string {
            const classMember: java.JavaClassMember | undefined = this.microflowClass.classMembers.get(name);
            if (classMember) {
                const type: string= classMember.type;
                if (asObject) {
                    const regex: RegExp = /<([^>]+)>/;
                    const match: RegExpMatchArray | null = type.match(regex);
                    return match && match.length > 1 ? match[1] : type;
                }
                return type;
            }
            throw `Class member with name ${name} not found`;
        }

        private isList(type: string): boolean {
            const regex: RegExp = /<([^>]+)>/;
            const match: RegExpMatchArray | null = type.match(regex);
            return <boolean>(match && match.length > 1);
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            this.codeLines.forEach(codeLine => codeLines.push({indentIndex: indentIndex, content: codeLine}));
            return codeLines;
        }
    }

    // Action call actions

    export class JavaActionCallAction extends AbstractAction {
        readonly javaActionCallAction: microflows.JavaActionCallAction;
        readonly model: IModel;

        constructor(javaActionCallAction: microflows.JavaActionCallAction, model: IModel) {
            super();
            this.javaActionCallAction = javaActionCallAction;
            this.model = model;
            this.prepare();
        }

        private prepare(): void {
            this.useVariable = this.javaActionCallAction.useReturnVariable;
            if (this.javaActionCallAction.outputVariableName !== '') {
                this.variableAssignmentName = ju.parseName(this.javaActionCallAction.outputVariableName, ju.JavaName.MEMBER);
            }
            if (this.javaActionCallAction.javaActionQualifiedName) {
                // const javaAction = this.model.findJavaActionByQualifiedName(this.javaActionCallAction.javaActionQualifiedName);
                const javaAction = this.javaActionCallAction.javaAction;
                var returnType = 'Boolean';
                if (javaAction) {
                    returnType = ju.typeToJavaType(javaAction.actionReturnType.asLoaded());
                }
                this.variableAssignmentType = returnType;
            }
            console.log('variable', this.variableAssignmentName, this.variableAssignmentType);
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            if (this.javaActionCallAction.javaActionQualifiedName === null) {
                throw  `No java action type set/found for ${this.javaActionCallAction.id}`;
            }
            const javaActionQualifiedName = ju.getQualifiedNameJavaActionFromString(this.javaActionCallAction.javaActionQualifiedName);
            const line: string = `${this.useVariable && this.variableAssignmentType !== 'void' ? this.variableAssignmentName + ' = ' : ''}${javaActionQualifiedName}.execute(${this.javaActionCallAction.parameterMappings.map(x => ju.getJavaActionParameterValueString(x.parameterValue, this.model)).join(', ')});`;
            codeLines.push({indentIndex: indentIndex, content: line});
            return codeLines;
        }
    }

    export class MicroflowCallAction extends AbstractAction {
        readonly microflowCallAction: microflows.MicroflowCallAction;
        readonly model: IModel;

        constructor(microflowCallAction: microflows.MicroflowCallAction, model: IModel) {
            super();
            this.microflowCallAction = microflowCallAction;
            this.model = model;
            this.prepare();
        }

        private prepare(): void {
            this.useVariable = this.microflowCallAction.useReturnVariable;
            if (this.microflowCallAction.outputVariableName !== '') {
                this.variableAssignmentName = ju.parseName(this.microflowCallAction.outputVariableName, ju.JavaName.MEMBER);
            }
            if (this.microflowCallAction.microflowCall.microflowQualifiedName) {
                const microflowQualifiedName: string = this.microflowCallAction.microflowCall.microflowQualifiedName;
                if (microflowQualifiedName.startsWith('System.')) {
                    throw `Unimplemented system microflows: ${microflowQualifiedName}`;
                }
                const microflow = this.model.findMicroflowByQualifiedName(microflowQualifiedName);
                if (microflow) {
                    this.variableAssignmentType = ju.dataTypeToJavaType(microflow.microflowReturnType);
                }
            }
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            if (this.microflowCallAction.microflowCall.microflowQualifiedName === null) {
                throw  `No microflow type set/found for ${this.microflowCallAction.id}`;
            }
            const microflowQualifiedName = ju.getQualifiedNameMicroflowFromString(this.microflowCallAction.microflowCall.microflowQualifiedName);
            const microflowName = ju.parseName(ju.getNameFromString(this.microflowCallAction.microflowCall.microflowQualifiedName), ju.JavaName.MEMBER);
            const retrieveLine: string = `${microflowQualifiedName} ${microflowName} = (${microflowQualifiedName})core.MXCore.getMicroflow(${microflowQualifiedName}.class);`;
            const line: string = `${this.useVariable && this.variableAssignmentType !== 'void' ? this.variableAssignmentName + ' = ' : ''}${microflowName}.execute(${this.microflowCallAction.microflowCall.parameterMappings.map(x => ju.parseMxExpression(x.argument, this.model)).join(', ')});`;
            codeLines.push({indentIndex: indentIndex, content: retrieveLine});
            codeLines.push({indentIndex: indentIndex, content: line});
            return codeLines;
        }
    }

    // Variable actions

    export class ChangeVariableAction extends AbstractAction {
        readonly changeVariableAction: microflows.ChangeVariableAction;
        readonly model: IModel;

        constructor(changeVariableAction: microflows.ChangeVariableAction, model: IModel) {
            super();
            this.changeVariableAction = changeVariableAction;
            this.model = model;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            const line: string = `${ju.parseName(this.changeVariableAction.changeVariableName, ju.JavaName.MEMBER)} = ${ju.parseMxExpression(this.changeVariableAction.value, this.model) };`;
            codeLines.push({indentIndex: indentIndex, content: line});
            return codeLines;
        }
    }

    export class CreateVariableAction extends AbstractAction {
        readonly createVariableAction: microflows.CreateVariableAction;
        readonly model: IModel;

        constructor(createVariableAction: microflows.CreateVariableAction, model: IModel) {
            super();
            this.createVariableAction = createVariableAction;
            this.model = model;
            this.prepare();
        }

        private prepare(): void {
            this.variableAssignmentName = ju.parseName(this.createVariableAction.variableName, ju.JavaName.MEMBER);
            this.variableAssignmentType = ju.dataTypeToJavaType(this.createVariableAction.variableType);
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            const line: string = `${this.variableAssignmentName} = ${ju.parseMxExpression(this.createVariableAction.initialValue, this.model)};`;
            codeLines.push({indentIndex: indentIndex, content: line});
            return codeLines;
        }
    }

    // Client actions

    export class CloseFormAction extends AbstractAction {
        renderAction(indentIndex: number): render.CodeLine[] {
            return [{indentIndex: indentIndex, content: 'core.MXClient.closePage();'}]
        }
    }

    export class DownloadFileAction extends AbstractAction {
        readonly downloadFileAction: microflows.DownloadFileAction;

        constructor(downloadFileAction: microflows.DownloadFileAction) {
            super();
            this.downloadFileAction = downloadFileAction;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            const line: string = `core.MXClient.download(${this.downloadFileAction.fileDocumentVariableName}, ${this.downloadFileAction.showFileInBrowser ? 'true' : 'false'});`;
            codeLines.push({indentIndex: indentIndex, content: line});
            return codeLines;
        }
    }

    export class ShowHomePageAction extends AbstractAction {
        renderAction(indentIndex: number): render.CodeLine[] {
            return [{indentIndex: indentIndex, content: 'core.MXClient.showUserHomePage();'}]
        }
    }

    export class ShowMessageAction extends AbstractAction {
        readonly showMessageAction: microflows.ShowMessageAction;
        readonly model: IModel;

        constructor(showMessageAction: microflows.ShowMessageAction, model: IModel) {
            super();
            this.showMessageAction = showMessageAction;
            this.model = model;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            const line: string = 'core.MXClient.showMessage(' + ju.parseTemplate(this.showMessageAction.template, this.model) + ', ' + (this.showMessageAction.blocking ? 'true' : 'false') + ');';
            codeLines.push({indentIndex: indentIndex, content: line});
            return codeLines;
        }
    }

    export class ShowPageAction extends AbstractAction {
        readonly showPageAction: microflows.ShowPageAction;

        constructor(showPageAction: microflows.ShowPageAction) {
            super();
            this.showPageAction = showPageAction;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let pageTitle: string = 'null';
            let parameter: String = '';
            if (this.showPageAction.pageSettings.titleOverride) {
                const page = this.showPageAction.pageSettings.titleOverride.text.translations.find(t => t.languageCode === 'en_US');
                if (page && page.text) {
                    pageTitle = `"${page.text}"`;
                }
            }
            if (this.showPageAction.pageSettings.parameterMappings.length > 0) {
                parameter = ju.parseName(this.showPageAction.pageSettings.parameterMappings[0].argument, ju.JavaName.MEMBER, true);
            }
            let statement: string = `core.MXClient.showPage("${this.showPageAction.pageSettings.pageQualifiedName}", ${pageTitle}${(parameter ?  ', ' : '') + parameter});`;
            return [{indentIndex: indentIndex, content: statement}];
        }
    }

    export class ValidationFeedbackAction extends AbstractAction {
        renderAction(indentIndex: number): render.CodeLine[] {
            return [{indentIndex: indentIndex, content: 'core.MXClient.validationFeedbackAction();'}]
        }
    }

    // Integration actions

    // TODO: Call REST service
    export class RestCallAction extends AbstractAction {
        readonly restCallAction: microflows.RestCallAction;
        readonly model: IModel;

        constructor(restCallAction: microflows.RestCallAction, model: IModel) {
            super();
            this.restCallAction = restCallAction;
            this.model = model;
            //this.prepare();
        }

        private prepare() {
            throw `This type of action is not implemented yet: ${this.restCallAction.structureTypeName}`;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            const httpConfiguration: microflows.HttpConfiguration = this.restCallAction.httpConfiguration;
            
            let lines: string[] = [];
            lines.push('core.rest.HttpConfiguration httpConfiguration = new core.rest.HttpConfiguration();');
            //lines.push(`httpConfiguration.setLocation(${this.restCallAction.httpConfiguration.customLocation});`);
            lines.push('core.rest.RestCall restCall = new core.rest.RestCall(httpConfiguration);');
            let codeLines: render.CodeLine[] = [];
            lines.forEach(line => codeLines.push({indentIndex: indentIndex, content: line}));
            return codeLines;
        }
    }

    // TODO: Call web service
    export class WebServiceCallAction extends AbstractAction {
        readonly webServiceCallAction: microflows.WebServiceCallAction;
        readonly model: IModel;

        constructor(webServiceCallAction: microflows.WebServiceCallAction, model: IModel) {
            super();
            this.webServiceCallAction = webServiceCallAction;
            this.model = model;
            this.prepare();
        }

        private prepare() {
            throw `This type of action is not implemented yet: ${this.webServiceCallAction.structureTypeName}`;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            return codeLines;
        }
    }

    // TODO: Export with mapping (xml)
    export class ExportXmlAction extends AbstractAction {
        readonly exportXmlAction: microflows.ExportXmlAction;
        readonly model: IModel;

        constructor(exportXmlAction: microflows.ExportXmlAction, model: IModel) {
            super();
            this.exportXmlAction = exportXmlAction;
            this.model = model;
            this.prepare();
        }

        private prepare() {
            throw `This type of action is not implemented yet: ${this.exportXmlAction.structureTypeName}`;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            return codeLines;
        }
    }

    // TODO: Import with mapping (xml)
    export class ImportXmlAction extends AbstractAction {
        readonly importXmlAction: microflows.ImportXmlAction;
        readonly model: IModel;

        constructor(importXmlAction: microflows.ImportXmlAction, model: IModel) {
            super();
            this.importXmlAction = importXmlAction;
            this.model = model;
            this.prepare();
        }

        private prepare() {
            throw `This type of action is not implemented yet: ${this.importXmlAction.structureTypeName}`;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            return codeLines;
        }
    }

    // Logging actions

    export class LogMessageAction extends AbstractAction {
        readonly logMessageAction: microflows.LogMessageAction;
        readonly model: IModel;

        constructor(logMessageAction: microflows.LogMessageAction, model: IModel) {
            super();
            this.logMessageAction = logMessageAction;
            this.model = model;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            const line: string = `core.MXCore.log(${ju.parseMxExpression(this.logMessageAction.node, this.model) }, "${this.logMessageAction.level}", "${this.logMessageAction.messageTemplate.text.replace(/[\r\n]/g, ' ').replace(/\s\+/g, ' ') }");`;
            codeLines.push({indentIndex: indentIndex, content: line});
            return codeLines;
        }
    }

    // Document generation actions

    // TODO: Generate document
    export class GenerateDocumentAction extends AbstractAction {
        readonly generateDocumentAction: microflows.GenerateDocumentAction;
        readonly model: IModel;

        constructor(generateDocumentAction: microflows.GenerateDocumentAction, model: IModel) {
            super();
            this.generateDocumentAction = generateDocumentAction;
            this.model = model;
            this.prepare();
        }

        private prepare() {
            throw `This type of action is not implemented yet: ${this.generateDocumentAction.structureTypeName}`;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            return codeLines;
        }
    }

    // Old actions

    // TODO: App service call
    export class AppServiceCallAction extends AbstractAction {
        readonly appServiceCallAction: microflows.AppServiceCallAction;
        readonly model: IModel;

        constructor(appServiceCallAction: microflows.AppServiceCallAction, model: IModel) {
            super();
            this.appServiceCallAction = appServiceCallAction;
            this.model = model;
            this.prepare();
        }

        private prepare() {
            throw `This type of action is not implemented yet: ${this.appServiceCallAction.structureTypeName}`;
        }

        renderAction(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            return codeLines;
        }
    }
}