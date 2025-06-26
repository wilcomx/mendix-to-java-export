import { IModel, microflows } from "mendixmodelsdk";
import { render } from "../render/render"; 
import { javautils as ju } from '../java/utils';
import { java } from '../java/java';
import { microflowevents as events } from './events';
import { microflowactions as actions } from './actions';
import { microflowactivities as activities } from './activities';

export namespace microflow {
    export interface IMicrofowStep extends render.IRenderable {
        codeBlock: IMicroflowCodeBlock;
    }

    export class MicroflowClass extends java.JavaClass {
        readonly microflow: microflows.MicroflowBase;
        readonly model: IModel;
        mergeActions: microflows.ExclusiveMerge[] = [];
        
        constructor(microflow: microflows.MicroflowBase, model: IModel) {
            super(
                ju.parseName(microflow.name, ju.JavaName.CLASS_NAME), 
                ju.getPackageMicroflow(microflow)
            );
            this.microflow = microflow;
            this.model = model;
            this.extends = 'core.MicroflowCall';
            this.populateClass();
        }

        populateClass() {
            this.addExecutionMethod(this.getStartEvent());

            this.mergeActions = this.mergeActions.filter((item, index) => this.mergeActions.indexOf(item) === index);
            while(this.mergeActions.length !== 0) {
                let mergeAction = this.mergeActions.pop();
                if (mergeAction) {
                    this.addMergeMethod(mergeAction);
                }
            }
        }

        addMergeAction(mergeAction: microflows.ExclusiveMerge): void {
            this.mergeActions.push(mergeAction);
        }

        removeMergeAction(mergeAction: microflows.ExclusiveMerge): void {
            this.mergeActions.splice(this.mergeActions.lastIndexOf(mergeAction), 1);
        }

        getNextMicroflowObject(currentObject: microflows.MicroflowObject): microflows.MicroflowObject | null {
            const flows = this.microflow.flows
                .filter(flow => flow instanceof microflows.SequenceFlow && flow.origin === currentObject && !flow.isErrorHandler);
            if (flows.length === 1) {
                return flows[0].destination;
            }
            if (flows.length === 0) {
                return null;
            }
            throw `${flows.length} flows found originating from ${currentObject.structureTypeName}`;
        }

        getStartEvent(): microflows.StartEvent {
            const startEvents: microflows.StartEvent[] = this.microflow.objectCollection.objects.filter(o => o instanceof microflows.StartEvent);
            if (startEvents.length === 1) {
                return startEvents[0];
            }
            throw `${startEvents.length} start events found for microflow ${this.microflow.name}`;
        }

        walkMicroflowSteps(microflowObject: microflows.MicroflowObject, microflowCodeBlock: IMicroflowCodeBlock): IMicroflowCodeBlock {
            this.addAnnotations(microflowObject, microflowCodeBlock);
            if (microflowObject instanceof microflows.StartEvent || microflowObject instanceof microflows.ActionActivity) {
                if (microflowObject instanceof microflows.ActionActivity) {
                    this.handleActionActivity(microflowObject, microflowCodeBlock);
                }
                const nextMicroflowObject: microflows.MicroflowObject | null = this.getNextMicroflowObject(microflowObject);
                if (nextMicroflowObject) {
                    return this.walkMicroflowSteps(nextMicroflowObject, microflowCodeBlock);
                }
                return microflowCodeBlock;
            } else if (microflowObject instanceof microflows.LoopedActivity) {
                const destinationIds: string[] = this.microflow.flows
                    .filter(flow => flow instanceof microflows.SequenceFlow)
                    .map(sequenceFlow => (<microflows.SequenceFlow>sequenceFlow).destination.id);
                const items: microflows.MicroflowObject[] = microflowObject.objectCollection.objects
                    .filter(microflowObj => !(destinationIds.includes(microflowObj.id) || microflowObj instanceof microflows.Annotation));
                if (items.length !== 1) {
                    throw `${items.length} start items found for activity loop. Can only be one item.`
                }
                const codeBlock = this.walkMicroflowSteps(items[0], new MicroflowCodeBlock(microflowCodeBlock, null));
                const loopedActivity = new activities.LoopedActivity(microflowObject, codeBlock, this.model);
                const errorCodeBlock: IMicroflowCodeBlock | null = this.getErrorCodeBlock(microflowObject, microflowCodeBlock);
                if (errorCodeBlock) {
                    loopedActivity.setErrorCodeBlock(errorCodeBlock);
                }
                microflowCodeBlock.addCodeBlockItem(loopedActivity);
                const nextMicroflowObject: microflows.MicroflowObject | null = this.getNextMicroflowObject(microflowObject);
                if (nextMicroflowObject) {
                    return this.walkMicroflowSteps(nextMicroflowObject, microflowCodeBlock);
                }
                return microflowCodeBlock;
            } else if (microflowObject instanceof microflows.ExclusiveMerge) {
                const renderableExclusiveMerge = new events.ExclusiveMerge(microflowObject, microflowCodeBlock.returnType, this.microflow);
                if (renderableExclusiveMerge.getNumIncomingFlows() === 1) {
                    // Ingnore this step since it isn't merging two or more flows
                    const nextMicroflowObject: microflows.MicroflowObject | null = this.getNextMicroflowObject(microflowObject);
                    if (nextMicroflowObject) {
                        return this.walkMicroflowSteps(nextMicroflowObject, microflowCodeBlock);
                    }
                    return microflowCodeBlock;
                }
                microflowCodeBlock.addCodeBlockItem(renderableExclusiveMerge);
                this.addMergeAction(microflowObject);
            } else if (microflowObject instanceof microflows.ExclusiveSplit) {
                let renderableExclusiveSplit: events.ExclusiveSplit = new events.ExclusiveSplit(microflowObject, this.model);
                const handledSplit: IMicroflowCodeBlock | null = this.handleSplit(renderableExclusiveSplit, microflowCodeBlock);
                if (handledSplit) {
                    return handledSplit;
                }
            } else if (microflowObject instanceof microflows.InheritanceSplit) {
                let renderableInheritanceSplit: events.InheritanceSplit = new events.InheritanceSplit(microflowObject, this.model);
                const handledSplit: IMicroflowCodeBlock | null = this.handleSplit(renderableInheritanceSplit, microflowCodeBlock);
                if (handledSplit) {
                    return handledSplit;
                }
            } else if (microflowObject instanceof microflows.EndEvent) {
                microflowCodeBlock.addCodeBlockItem(
                    new events.EndEvent(microflowObject, this.model)
                );
            } else if (microflowObject instanceof microflows.BreakEvent) {
                microflowCodeBlock.addCodeBlockItem(
                    new java.SingleStatement('break;')
                );
            } else if (microflowObject instanceof microflows.ContinueEvent) {
                microflowCodeBlock.addCodeBlockItem(
                    new java.SingleStatement('continue;')
                );
            } else if (microflowObject instanceof microflows.ErrorEvent) {
                microflowCodeBlock.addCodeBlockItem(
                    new java.SingleStatement('throw new RuntimeException(e);')
                );
            } else {
                throw `No handling implemented for microflow object of type ${microflowObject.structureTypeName}`;
            }
            return microflowCodeBlock;
        }

        handleActionActivity(activity: microflows.ActionActivity, microflowCodeBlock: IMicroflowCodeBlock) {
            let renderableActivity: actions.AbstractAction;
            const action: microflows.MicroflowAction | null = activity.action;
            if (action === null) {
                throw `No action set for action activity ${activity.id}`;
            }
            // Object actions
            if (action instanceof microflows.CastAction) {
                renderableActivity = new actions.CastAction(action, <InheritanceCodeBlock>microflowCodeBlock);
            } else if (action instanceof microflows.ChangeObjectAction) {
                renderableActivity = new actions.ChangeObjectAction(action, this.model);
            } else if (action instanceof microflows.CommitAction) {
                renderableActivity = new actions.CommitAction(action);
            } else if (action instanceof microflows.CreateObjectAction) {
                renderableActivity = new actions.CreateObjectAction(action, this.model);
            } else if (action instanceof microflows.DeleteAction) {
                renderableActivity = new actions.DeleteAction(action);
            } else if (action instanceof microflows.RetrieveAction) {
                renderableActivity = new actions.RetrieveAction(action, this.model);
            } else if (action instanceof microflows.RollbackAction) {
                renderableActivity = new actions.RollbackAction();
            } 
            // List actions
            else if (action instanceof microflows.AggregateListAction) {
                renderableActivity = new actions.AggregateListAction(action, this.model);
            } else if (action instanceof microflows.ChangeListAction) {
                renderableActivity = new actions.ChangeListAction(action, this.model);
            } else if (action instanceof microflows.CreateListAction) {
                renderableActivity = new actions.CreateListAction(action, this.model);
            } else if (action instanceof microflows.ListOperationAction) {
                renderableActivity = new actions.ListOperationAction(action, this.model, this);
            } 
            // Action call actions
            else if (action instanceof microflows.JavaActionCallAction) {
                renderableActivity = new actions.JavaActionCallAction(action, this.model);
            } else if (action instanceof microflows.MicroflowCallAction) {
                renderableActivity = new actions.MicroflowCallAction(action, this.model)
            }
            // Variable actions
            else if (action instanceof microflows.ChangeVariableAction) {
                renderableActivity = new actions.ChangeVariableAction(action, this.model);
            } else if (action instanceof microflows.CreateVariableAction) {
                renderableActivity = new actions.CreateVariableAction(action, this.model);
            } 
            // Client actions
            else if (action instanceof microflows.CloseFormAction) {
                renderableActivity = new actions.CloseFormAction();
            } else if (action instanceof microflows.DownloadFileAction) {
                renderableActivity = new actions.DownloadFileAction(action);
            } else if (action instanceof microflows.ShowHomePageAction) {
                renderableActivity = new actions.ShowHomePageAction();
            } else if (action instanceof microflows.ShowMessageAction) {
                renderableActivity = new actions.ShowMessageAction(action, this.model);
            } else if (action instanceof microflows.ShowPageAction) {
                renderableActivity = new actions.ShowPageAction(action);
            } else if (action instanceof microflows.ValidationFeedbackAction) {
                renderableActivity = new actions.ValidationFeedbackAction();
            } 
            // Integration actions
            else if (action instanceof microflows.RestCallAction) {
                renderableActivity = new actions.RestCallAction(action, this.model);
            } else if (action instanceof microflows.WebServiceCallAction) {
                renderableActivity = new actions.WebServiceCallAction(action, this.model);
            } else if (action instanceof microflows.ExportXmlAction) {
                renderableActivity = new actions.ExportXmlAction(action, this.model);
            } else if (action instanceof microflows.ImportXmlAction) {
                renderableActivity = new actions.ImportXmlAction(action, this.model);
            } 
            // Logging
            else if (action instanceof microflows.LogMessageAction) {
                renderableActivity = new actions.LogMessageAction(action, this.model);
            } 
            // Document generation actions
            else if (action instanceof microflows.GenerateDocumentAction) {
                renderableActivity = new actions.GenerateDocumentAction(action, this.model);
            } 
            // Old actions
            else if (action instanceof microflows.AppServiceCallAction) {
                renderableActivity = new actions.AppServiceCallAction(action, this.model);
            } else {
                throw `No handling implemented for microflow action of type ${action.structureTypeName}`;
            }
            const variableAssignment: java.Variable | null = renderableActivity.getVariableAssignment();
            if (variableAssignment && variableAssignment.type !== 'void') {
                const classMember: java.JavaClassMember = new java.JavaClassMember(variableAssignment.name, variableAssignment.type);
                classMember.accessModifier = java.AccessModifier.PRIVATE;
                this.addClassMember(classMember);
            }
            const errorCodeBlock: IMicroflowCodeBlock | null = this.getErrorCodeBlock(activity, microflowCodeBlock);
            if (errorCodeBlock) {
                renderableActivity.setErrorCodeBlock(errorCodeBlock);
            }
            microflowCodeBlock.addCodeBlockItem(renderableActivity);
        }

        handleSplit(split: events.AbstractSplit, microflowCodeBlock: IMicroflowCodeBlock): IMicroflowCodeBlock | null {
            const microflowObject: microflows.MicroflowObject = split.getSplitMicroflowObject();
            let codeBlock: IMicroflowCodeBlock;
            this.microflow.flows
                .filter(flow => flow instanceof microflows.SequenceFlow && flow.origin === microflowObject)
                .forEach(flow => {
                    if (split instanceof events.InheritanceSplit) {
                        let inheritedEntityQualifiedName: string | null = (<microflows.InheritanceCase>(<microflows.SequenceFlow>flow).caseValue).valueQualifiedName;
                        codeBlock = new InheritanceCodeBlock(
                            microflowCodeBlock,
                            microflowCodeBlock.returnType,
                            {
                                name: split.inheritanceSplit.splitVariableName,
                                type: inheritedEntityQualifiedName ? ju.getQualifiedNameEntityFromString(inheritedEntityQualifiedName) : 'null'
                            }
                        );
                    } else if (split instanceof events.ExclusiveSplit) {
                        codeBlock = new MicroflowCodeBlock(microflowCodeBlock, microflowCodeBlock.returnType);
                    }
                    split.addMicroFlowCodeBlock(
                        this.walkMicroflowSteps(
                            flow.destination,
                            codeBlock
                        ),
                        (<microflows.SequenceFlow>flow).caseValue
                    );
                });
            microflowCodeBlock.addCodeBlockItem(split);
            const sameMerge: microflows.ExclusiveMerge | null = split.endsWithSameExclusiveMerge();
            if (sameMerge) {
                split.removeLastMicroflowCodeBlockItemFromAllCodeBlocks();
                this.removeMergeAction(sameMerge);
                const nextMicroflowObject: microflows.MicroflowObject | null = this.getNextMicroflowObject(sameMerge);
                if (nextMicroflowObject) {
                    return this.walkMicroflowSteps(nextMicroflowObject, microflowCodeBlock);
                }
                return microflowCodeBlock;
            }
            return null;
        }

        getErrorCodeBlock(activity: microflows.Activity, microflowCodeBlock: IMicroflowCodeBlock): IMicroflowCodeBlock | null {
            const flows = this.microflow.flows
                .filter(flow => flow instanceof microflows.SequenceFlow && flow.origin === activity && flow.isErrorHandler);
            if (flows.length === 0) {
                return null;
            }
            if (flows.length === 1) {
                const errorMicroflowCodeBlock = new MicroflowCodeBlock(microflowCodeBlock, microflowCodeBlock.returnType);
                return this.walkMicroflowSteps(flows[0].destination, errorMicroflowCodeBlock);
            }
            throw `${flows.length} error flows found originating from ${activity.toJSON()}`;
        }

        addExecutionMethod(startEvent: microflows.StartEvent): void {
            let returnType: string = ju.dataTypeToJavaType(this.microflow.microflowReturnType);
            let microflowCodeBlock = new MicroflowCodeBlock(null, returnType);
            let codeBlock: IMicroflowCodeBlock = this.walkMicroflowSteps(startEvent, microflowCodeBlock);
            let method = new java.JavaClassMethod('execute', returnType, codeBlock, this.getMicroflowParameters(this.microflow));
            method.accessModifier = java.AccessModifier.PUBLIC;
            this.addMethod(method);
        }

        addMergeMethod(exclusiveMerge: microflows.ExclusiveMerge): void {
            let returnType: string = ju.dataTypeToJavaType(this.microflow.microflowReturnType);
            const renderableExclusiveMerge = new events.ExclusiveMerge(exclusiveMerge, returnType, this.microflow);
            if (this.hasMethod(renderableExclusiveMerge.getMethodName())) {
                return;
            }
            let microflowCodeBlock = new MicroflowCodeBlock(null, returnType);
            const nextMicroflowObject: microflows.MicroflowObject | null = this.getNextMicroflowObject(exclusiveMerge);
            if (nextMicroflowObject) {
                let codeBlock: IMicroflowCodeBlock = this.walkMicroflowSteps(nextMicroflowObject, microflowCodeBlock);
                let method = new java.JavaClassMethod(renderableExclusiveMerge.getMethodName(), returnType, codeBlock, this.getMicroflowParameters(this.microflow));
                method.accessModifier = java.AccessModifier.PRIVATE;
                this.addMethod(method);
            }
        }

        addAnnotations(microflowObject: microflows.MicroflowObject, microflowCodeBlock: IMicroflowCodeBlock): void {
            let annotations: microflows.Annotation[] = [];
            this.microflow.flows
                .filter(flow => flow instanceof microflows.AnnotationFlow && (flow.destination === microflowObject || flow.origin === microflowObject))
                .forEach(annotationFlow => {
                    if (annotationFlow.destination instanceof microflows.Annotation) {
                        annotations.push(annotationFlow.destination);
                    } else if (annotationFlow.origin instanceof microflows.Annotation) {
                        annotations.push(annotationFlow.origin);
                    }
            });
            annotations.forEach(annotation => microflowCodeBlock.addCodeBlockItem(new Annotation(annotation)));
        }

        getMicroflowParameters(microflow: microflows.MicroflowBase): java.MethodParameter[] {
            let variables: java.MethodParameter[] = [];
            microflow.objectCollection.objects.filter(o => o instanceof microflows.MicroflowParameterObject).forEach((o) => {
                const microflowParameter = <microflows.MicroflowParameterObject>o;
                variables.push({
                    name: ju.parseName(microflowParameter.name, ju.JavaName.MEMBER), 
                    type: ju.dataTypeToJavaType(microflowParameter.variableType),
                    final: false
                });
            });
            return variables;
        }
    }

    export function renderMicroflow(microflow: microflows.MicroflowBase, model: IModel): string {
        const mf: MicroflowClass = new MicroflowClass(microflow, model);
        return render.renderCodeLines(mf.render(0));
    }

    export interface IMicroflowCodeBlock extends java.ICodeBlock {
        getLastCodeBlockItem(): java.ICodeBlockItem | null;
        removeLastCodeBlockItem(): void;
    }

    export class MicroflowCodeBlock extends java.AbstractCodeBlock implements IMicroflowCodeBlock {
        constructor(parent: IMicroflowCodeBlock | null, returnType: string | null) {
            super(parent, returnType);
        }

        getLastCodeBlockItem(): java.ICodeBlockItem | null {
            if (this.codeBlockItems.length > 0) {
                return this.codeBlockItems[this.codeBlockItems.length - 1];
            }
            return null;
        }

        removeLastCodeBlockItem(): void {
            this.codeBlockItems.pop();
        }
    }

    export class InheritanceCodeBlock extends MicroflowCodeBlock {
        readonly inheritedVariable: java.Variable;
        constructor(parent: IMicroflowCodeBlock | null, returnType: string | null, inheritedVariable: java.Variable) {
            super(parent, returnType);
            this.inheritedVariable = inheritedVariable;
        }
    }

    export class Annotation implements java.ICodeBlockItem {
        readonly annotation: microflows.Annotation;

        constructor(annotation: microflows.Annotation) {
            this.annotation = annotation;
        }

        render(indentIndex: number): render.CodeLine[] {
            let codeLines: render.CodeLine[] = [];
            this.annotation.caption
                .replace(/\r/g, '')
                .split('\n')
                .map(x => '// ' + x)
                .forEach(caption => codeLines.push({indentIndex: indentIndex, content: caption}));
            return codeLines;
        }
    }
}
