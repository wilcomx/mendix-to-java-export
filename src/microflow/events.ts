import { microflows, IModel } from "mendixmodelsdk";
import { render } from "../render/render"; 
import { javautils as ju } from '../java/utils';
import { java } from '../java/java';
import { microflow } from './microflow';

export namespace microflowevents {
    export class EndEvent implements java.ICodeBlockItem {
        readonly endEvent: microflows.EndEvent;
        readonly model: IModel;

        constructor(endEvent: microflows.EndEvent, model: IModel) {
            this.endEvent = endEvent;
            this.model = model;
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            if (this.endEvent.returnValue) {
                codeLines.push({indentIndex: indentIndex, content: `return ${ju.parseMxExpression(this.endEvent.returnValue, this.model)};`});
            }
            return codeLines;
        }
    }

    export abstract class AbstractSplit implements java.ICodeBlockItem {
        protected caseValues: Map<microflows.CaseValue, microflow.IMicroflowCodeBlock> = new Map<microflows.CaseValue, microflow.IMicroflowCodeBlock>();
        protected model: IModel;

        constructor(model: IModel) {
            this.model = model;
        }

        abstract render(indentIndex: number): render.CodeLine[];

        abstract getNumIncomingFlows(exclusiveMerge: microflows.ExclusiveMerge): number;

        abstract getSplitMicroflowObject(): microflows.MicroflowObject;

        endsWithSameExclusiveMerge(): microflows.ExclusiveMerge | null {
            let microflowObjects: microflows.MicroflowObject[] = [];
            for (const entry of this.caseValues) {
                let microflowBlockItem: java.ICodeBlockItem | null = entry[1].getLastCodeBlockItem();
                if (microflowBlockItem && microflowBlockItem instanceof ExclusiveMerge) {
                    microflowObjects.push(microflowBlockItem.exclusiveMerge);
                } else {
                    return null;
                }
            }
            const firstExclusiveMerge: microflows.ExclusiveMerge = microflowObjects[0];
            for(let exclusiveMerge of microflowObjects) {
                if (exclusiveMerge !== firstExclusiveMerge) {
                    return null;
                }
            }
            const numIncomingFlows: number = this.getNumIncomingFlows(firstExclusiveMerge);
            if (numIncomingFlows !== this.caseValues.size) {
                return null;
            }
            return firstExclusiveMerge;
        }

        removeLastMicroflowCodeBlockItemFromAllCodeBlocks(): void {
            this.caseValues.forEach((microflowCodeBlock) => {
                microflowCodeBlock.removeLastCodeBlockItem();
            })
        }

        addMicroFlowCodeBlock(microflowCodeBlock: microflow.IMicroflowCodeBlock, caseValue: microflows.CaseValue) {
            this.caseValues.set(caseValue, microflowCodeBlock);
        }

        getMicroflowCodeBlockByCaseValue(value: string): microflow.IMicroflowCodeBlock {
            for(let entry of this.caseValues.entries()) {
                let caseValue: microflows.CaseValue = entry[0];
                if (caseValue instanceof microflows.EnumerationCase && caseValue.value === value) {
                    return entry[1];
                }
            }
            throw `No case found with value ${value}`;
        }
    }

    export class ExclusiveSplit extends AbstractSplit {
        readonly exclusiveSplit: microflows.ExclusiveSplit;
        
        constructor(exclusiveSplit: microflows.ExclusiveSplit, model: IModel) {
            super(model);
            this.exclusiveSplit = exclusiveSplit;
        }

        getSplitMicroflowObject(): microflows.MicroflowObject {
            return this.exclusiveSplit;
        }

        isIfElseSplit(): boolean {
            if (this.caseValues.size === 2) {
                for(let caseValue of this.caseValues.keys()) {
                    if (!(caseValue instanceof microflows.EnumerationCase) || !['true', 'false'].includes(caseValue.value)) {
                        return false;
                    }
                }
                return true;
            }
            return false;
        }

        getNumIncomingFlows(exclusiveMerge: microflows.ExclusiveMerge): number {
            return this.exclusiveSplit.containerAsMicroflowObjectCollection.containerAsMicroflowBase.flows
            .filter(flow => flow.destination === exclusiveMerge).length;
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            if (this.isIfElseSplit()) {
                const ifCodeBlock: microflow.IMicroflowCodeBlock = this.getMicroflowCodeBlockByCaseValue('true');
                const elseCodeBlock: microflow.IMicroflowCodeBlock = this.getMicroflowCodeBlockByCaseValue('false');
                let splitCondition: microflows.SplitCondition = this.exclusiveSplit.splitCondition;
                let evaluation: string;
                if (splitCondition instanceof microflows.ExpressionSplitCondition) {
                    evaluation = ju.parseMxExpression(splitCondition.expression, this.model);
                } else if (splitCondition instanceof microflows.RuleSplitCondition) {
                    if (splitCondition.ruleCall.ruleQualifiedName === null) {
                        throw `No qualified name defined for Rule: ${splitCondition.ruleCall.id}`;
                    }
                    const paramList = splitCondition.ruleCall.parameterMappings.map(x => ju.parseMxExpression(x.argument, this.model)).join(', ');
                    evaluation = `${ju.getQualifiedNameRuleFromString(splitCondition.ruleCall.ruleQualifiedName)}.execute(${paramList})`;
                } else {
                    throw `Unhandled type of split condition ${splitCondition.structureTypeName}`;
                }
                codeLines.push({indentIndex: indentIndex, content: `if (${ju.parseMxExpression(evaluation, this.model)}) {`});
                codeLines = codeLines.concat(ifCodeBlock.render(indentIndex + 1));
                if (elseCodeBlock.getItemCount() > 0) {
                    codeLines.push({indentIndex: indentIndex, content: `} else {`});
                    codeLines = codeLines.concat(elseCodeBlock.render(indentIndex + 1));
                }
                codeLines.push({indentIndex: indentIndex, content: `}`});
            } else {
                let counter: number = 0;
                this.caseValues.forEach((microflowCodeBlock, caseValue) => {
                    let enumerationCase = <microflows.EnumerationCase>caseValue;
                    let expression = enumerationCase.value;
                    codeLines.push({indentIndex: indentIndex, content: `${counter !== 0 ? '} else ' : ''}if (${expression}) {`});
                    codeLines = codeLines.concat(microflowCodeBlock.render(indentIndex + 1));
                    counter++;
                });

                codeLines.push({indentIndex: indentIndex, content: `}`});
            }
            return codeLines;
        }
    }

    export class InheritanceSplit extends AbstractSplit {
        readonly inheritanceSplit: microflows.InheritanceSplit;
        
        constructor(inheritanceSplit: microflows.InheritanceSplit, model: IModel) {
            super(model);
            this.inheritanceSplit = inheritanceSplit;
        }

        getSplitMicroflowObject(): microflows.MicroflowObject {
            return this.inheritanceSplit;
        }
        
        getNumIncomingFlows(exclusiveMerge: microflows.ExclusiveMerge): number {
            return this.inheritanceSplit.containerAsMicroflowObjectCollection.containerAsMicroflowBase.flows
            .filter(flow => flow.destination === exclusiveMerge).length;
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            let counter: number = 0;
            this.caseValues.forEach((microflowCodeBlock) => {
                let inheritanceCodeBlock: microflow.InheritanceCodeBlock = <microflow.InheritanceCodeBlock>microflowCodeBlock;
                if (inheritanceCodeBlock.getItemCount() > 0 && inheritanceCodeBlock.inheritedVariable.type !== 'null') {
                    let type: string = inheritanceCodeBlock.inheritedVariable.type;
                    let name: string = ju.parseName(this.inheritanceSplit.splitVariableName, ju.JavaName.MEMBER);
                    let expression = `${name} instanceof ${type}`;
                    codeLines.push({indentIndex: indentIndex, content: `${counter !== 0 ? '} else ' : ''}if (${expression}) {`});
                    codeLines = codeLines.concat(microflowCodeBlock.render(indentIndex + 1));
                    counter++;
                }
            });
            this.caseValues.forEach((microflowCodeBlock) => {
                let inheritanceCodeBlock: microflow.InheritanceCodeBlock = <microflow.InheritanceCodeBlock>microflowCodeBlock;
                if (inheritanceCodeBlock.getItemCount() > 0 && inheritanceCodeBlock.inheritedVariable.type === 'null') {
                    let type: string = inheritanceCodeBlock.inheritedVariable.type;
                    let name: string = ju.parseName(this.inheritanceSplit.splitVariableName, ju.JavaName.MEMBER);
                    let expression = `${name} == null`;
                    codeLines.push({indentIndex: indentIndex, content: '} else {'});
                    codeLines = codeLines.concat(microflowCodeBlock.render(indentIndex + 1));
                    counter++;
                }
            });
            if (counter > 0) {
                codeLines.push({indentIndex: indentIndex, content: `}`});
            }
            return codeLines;
        }
    }

    export class ExclusiveMerge implements java.ICodeBlockItem {
        readonly exclusiveMerge: microflows.ExclusiveMerge;
        readonly returnStatement: string | null;
        readonly microflow: microflows.MicroflowBase;

        constructor(exclusiveMerge: microflows.ExclusiveMerge, returnStatement: string | null, microflow: microflows.MicroflowBase) {
            this.exclusiveMerge = exclusiveMerge;
            this.returnStatement = returnStatement;
            this.microflow = microflow;
        }

        getNumIncomingFlows(): number {
            return this.microflow.flows
            .filter(flow => flow instanceof microflows.SequenceFlow && flow.destination === this.exclusiveMerge).length;
        }

        getMethodName() {
            return 'continueMerge' + this.exclusiveMerge.id.toUpperCase().replace(/[^a-z]+/gi , '').substring(0, 5);
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            const withReturnStatement: boolean = this.returnStatement !== null && this.returnStatement !== 'void';
            codeLines.push({indentIndex: indentIndex, content: `${withReturnStatement ? 'return ' : ''}${this.getMethodName()}();`});
            return codeLines;
        }
    }
}