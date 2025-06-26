import { IModel, domainmodels, microflows, javaactions, pages, navigation, texts, datatypes, mappings } from "mendixmodelsdk";
import {javautils as ju} from './java/utils';

var variables: { [index: string]: string} = {};

export function renderMicroflow(microflow: microflows.Microflow, model: IModel): string {
    variables = {};
    return renderMicroflowBase(microflow, model);
}

export function renderRule(rule: microflows.Rule, model: IModel): string {
    variables = {};
    return renderMicroflowBase(rule, model);
}

function renderMicroflowBase(microflow: microflows.MicroflowBase, model: IModel): string {
    var params = getMicroflowParameterLine(microflow, model);

    var lines = microflowToText(microflow, model);
    if (lines.length > 0) {
        if (lines[lines.length - 1] === 'return ;') {
            lines.pop();
        }
    }

    var variableLines = [];
    for (var v in variables) {
        const def = `${variables[v]} ${v}`;
        if (params.indexOf(def) === -1) {
            variableLines.push(`\t\t${variables[v]} ${v};`);
        }
    }
    return `package ${ju.getPackageMicroflow(microflow)};

import core.MXClient;
import core.MXCore;

public class ${microflow.name} extends core.MicroflowCall {

	public static ${getReturnTypeOfMicroflow(microflow) } execute(${params}) {
${variableLines.join('\n') }

${lines.map(x => '\t\t' + x).join('\n') }
	};

}
`;
}

export function getType(model: IModel, typeString: string): string {
    if (typeString === 'Boolean' || typeString === 'String') {
        // OK
    } else if (typeString === 'Integer') {
        typeString = 'Long';
    } else if (typeString === 'DateTime') {
        typeString = 'java.util.Date';
    } else if (typeString === 'Void') {
        typeString = 'void';
    } else if (typeString === 'Unknown') {
        typeString = 'Object';
    } else if (typeString[0] == '#') {
        typeString = typeString.substr(1).replace('.', '.enumeration.');
    } else if (typeString[0] == '[') {
        typeString = typeString.substr(1, typeString.length - 2);
        typeString = `java.util.List<${getType(model, typeString) }>`;
    } else {
        const splitted = typeString.split('.');

        let moduleName = splitted[0];
        if (moduleName === 'System') {
            moduleName = 'MXSystem';
        }

        const entityName = splitted[1];

        if (moduleName === 'MXSystem' || model.allModules().some(m => m.name === moduleName)) {
            typeString = `${moduleName}.domain.${entityName}`;
        } else if (model.allConsumedAppServices().some(cas => cas.name === moduleName)) {
            const containingModuleName = ju.getPackageConsumedAppService(model.allConsumedAppServices().filter(cas => cas.name === moduleName)[0]);
            typeString = `${containingModuleName}.appservices.${moduleName}.${entityName}`;
        } else {
            throw `Module name is neither System, nor an existing user or app store module, nor an app service name: ${moduleName}`;
        }

    }
    return typeString;
}


function getReturnTypeOfMicroflow(microflow: microflows.MicroflowBase): string {
    return ju.dataTypeToJavaType(microflow.microflowReturnType);
}


function getReturnTypeOfJavaAction(javaaction: javaactions.JavaAction): string {
    return ju.typeToJavaType(javaaction.actionReturnType.asLoaded());
}

function getJavaActionParameterValueString(javaActionParameterValue: microflows.JavaActionParameterValue, model: IModel): string {
    if (javaActionParameterValue instanceof microflows.BasicJavaActionParameterValue) {
        return parseMxExpression(javaActionParameterValue.argument, model)
    } else {
        throw `JavaActionParameterValue type not implemented: ${javaActionParameterValue.toJSON()}`;
    }
}

function parseMxExpression(input: string, model: IModel): string {
    input = input.replace(/\(/g, '( ').replace(/\)/g, ' )');
    input = (' ' + input + ' ').replace(/\$/g, '').replace(/'/g, '"').replace(/\n/g, ' ').replace(/\r/g, '').replace(/\s+/g, ' ').replace(/\sand\s/g, ' && ').replace(/\sor\s/g, ' || ').replace(/if\s/g, '').replace(/\s?then\s?/g, ' ? ').replace(/\s?else\s?/g, ' : ').replace(/\sempty\s/g, ' null ').replace(/\s=\s/g, ' == ').replace(/\s([0-9]+)\s/g, function(m, m1) { return ' ' + m1 + 'l ' });
    if (input.indexOf('@') !== -1) {
        model.allConstants().map(c => c.asLoaded()).forEach(constant => {
            input = input.replace(`@${constant.qualifiedName}`, `MXCore.get${constant.dataType}Constant("${constant.qualifiedName}")`);
        });
    }
    input = input.replace(/\[%CurrentDateTime%\]/g, 'new java.util.Date()');
    input = input.replace(/\s([a-zA-Z0-9_]+)\/[a-zA-Z0-9]+\.([a-zA-Z0-9_]+)\s/g, function(m, m1, m2) {
        return ` ${m1}.get${m2}() `;
    });
    input = input.replace(/\s([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)\s/g, function(m, m1, m2) {
        return ` ${m1}.get${m2}() `;
    });
    // The next one fixes arguments to formatDateTime, but also just happily replaces anything in a string literal. Not good.
    input = input.replace(/([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)/g, function(m, m1, m2) {
        return ` ${m1}.get${m2}() `;
    });
    input = input.replace(/(\[%.*?%\])/g, function(match, n1) {
        return '"' + n1 + '"';
    });
    input = input.replace(/\(\s*/g, '(').replace(/\s*\)/g, ')');

    model.allEnumerations()
        .forEach(e => { 
            if (e.qualifiedName !== null) {
                input = input.replace(e.qualifiedName, ju.getQualifiedNameEnumeration(e))
            }
        });

    return input.trim();
}


function getLineRepresentationOfAction(action: microflows.MicroflowAction, model: IModel): string[] {
    if (action instanceof microflows.AggregateListAction) {
        var aggregateFunction = action.aggregateFunction.name.toLowerCase();
        var returnType = 'double';
        if (aggregateFunction === 'count') {
            returnType = 'long';
        }
        variables[action.outputVariableName] = returnType;
        return [`${action.outputVariableName} = ${action.inputListVariableName}.stream().${aggregateFunction === 'count' ? '' : 'mapToDouble(value => value.get' + action.attribute + '()).'}${aggregateFunction}();`];
    } else if (action instanceof microflows.AppServiceCallAction && action.appServiceActionQualifiedName !== null && action.appServiceAction !== null) {
        const splitted = action.appServiceActionQualifiedName.split('.');
        const moduleName = splitted[0];
        const appServiceName = splitted[1];
        const actionName = splitted[2];

        const paramList = action.parameterMappings.map(p => parseMxExpression(p.argument, model)).join(', ');
        const expression = `${moduleName}.appservices.${appServiceName}.${actionName}(${paramList});`;

        const varType = getType(action.model, action.appServiceAction.asLoaded().returnType)
            /*.replace('.domain.', '.')
            .replace(appServiceName, `${moduleName}.appservices.${appServiceName}`)*/;
        const varName = action.outputVariableName;

        if (varName && varType !== 'void') {
            variables[varName] = varType;
            return [`${varName} = ${expression}`];
        } else {
            return [expression];
        }
    } else if (action instanceof microflows.WebServiceCallAction && action.importedWebService !== null) {
        const call = `${ju.getQualifiedNameImportedWebService(action.importedWebService)}.${action.operationName}();`;

        if (action.resultHandling.storeInVariable) {
            const outputVarName = action.resultHandling.outputVariableName;
            if (action.resultHandling.importMappingCall !== null 
                    && action.resultHandling.importMappingCall.mapping !== null 
                    && action.resultHandling.importMappingCall.mapping.asLoaded().rootMappingElements.length > 0) {
                const entity: mappings.ObjectMappingElement = action.resultHandling.importMappingCall.mapping.asLoaded().rootMappingElements[0];
                if (entity instanceof domainmodels.Entity && entity.entityQualifiedName !== null) {
                    const outputType = getType(action.model, entity.entityQualifiedName);
                    variables[outputVarName] = outputType;
                }
            }
            return [`${outputVarName} = ${call}`];
        } else {
            return [call];
        }
    } else if (action instanceof microflows.CastAction) {
        action
        const castType: string = 'Object';
        variables[action.outputVariableName] = castType;
        return [`${action.outputVariableName} = (${castType})${action.outputVariableName};`];
    } else if (action instanceof microflows.ChangeObjectAction) {
        var result: string[] = [];
        action.items.forEach(x => {
            var z;
            if (x.attributeQualifiedName) {
                z = x.attributeQualifiedName.split('.').splice(2, 1);
            } else if (x.associationQualifiedName) {
                //z = x.associationQualifiedName.split('.').splice(2, 1);
                z = x.associationQualifiedName.split('.')[1];
            } else {
                throw `MemberChange without association or attribute: ${x.id}`
            }

            var newValue = parseMxExpression(x.value, model);
            if (x.attribute && x.attribute instanceof domainmodels.EnumerationAttributeType) { // TODO: this does not work
                newValue = newValue.replace('.', '.enumeration.');
            }
            result.push(`${action.changeVariableName}.set${z}(${newValue});`);
        });
        if (action.refreshInClient) {
            result.push(`MXClient.refresh(${action.changeVariableName});`);
        }
        if (action.commit == microflows.CommitEnum.Yes) {
            result.push(`MXCore.commit(${action.changeVariableName});`);
        }
        if (action.commit == microflows.CommitEnum.YesWithoutEvents) {
            result.push(`MXCore.commitWithoutEvents(${action.changeVariableName});`);
        }
        return result;
    } else if (action instanceof microflows.ChangeListAction) {
        return [`${action.changeVariableName}.${action.type.name.toLowerCase() }(${parseMxExpression(action.value, model) });`];
    } else if (action instanceof microflows.ChangeVariableAction) {
        return [`${action.changeVariableName} = ${parseMxExpression(action.value, model) };`];
    } else if (action instanceof microflows.CloseFormAction) {
        return ['MXClient.closePage();'];
    } else if (action instanceof microflows.CommitAction) {
        var result: string[] = ['MXCore.commit(' + action.commitVariableName + ', ' + action.withEvents + ');'];
        if (action.refreshInClient) {
            result.push(`MXClient.refresh(${action.commitVariableName});`);
        }
    } else if (action instanceof microflows.CreateObjectAction) {
        const setters = action.items.map(item => {
            let attribute: string;
            if (item.attributeQualifiedName) {
                attribute = item.attributeQualifiedName.split('.')[2];
            } else if (item.association !== null) {
                attribute = item.association.name;
            } else {
                throw  `Attribute not found to set for ${action.toJSON()}`;
            }
            return `${action.outputVariableName}.set${attribute}(${parseMxExpression(item.value, model) });`;
        });
        if (action.entityQualifiedName !== null) {
            const outputVariableType: string = ju.getQualifiedNameEntityFromString(action.entityQualifiedName)
            variables[action.outputVariableName] = outputVariableType;
            return [`${action.outputVariableName} = new ${outputVariableType}();`].concat(setters);
        }
        throw  `No entity type set/found for ${action.toJSON()}`;
    } else if (action instanceof microflows.CreateListAction) {
        if (action.entityQualifiedName !== null) {
            variables[action.outputVariableName] = `java.util.List<${getType(action.model, action.entityQualifiedName) }>`;
            return [`${action.outputVariableName} = new java.util.ArrayList<${getType(action.model, action.entityQualifiedName) }>();`];
        }
        throw  `No entity type set/found for ${action.toJSON()}`;
    } else if (action instanceof microflows.CreateVariableAction) {
        variables[action.variableName] = getType(action.model, action.variableDataType);
        return [`${action.variableName} = ${parseMxExpression(action.initialValue, model) };`];
    } else if (action instanceof microflows.DeleteAction) {
        var result: string[] = [];
        if (action.refreshInClient) {
            result.push(`MXClient.refresh(${action.deleteVariableName});`);
        }
        result.push(`MXCore.delete(${action.deleteVariableName});`);
        result.push(action.deleteVariableName + ' = null;');
        return result;
    } else if (action instanceof microflows.DownloadFileAction) {
        return [`MXClient.download(${action.fileDocumentVariableName}${action.showFileInBrowser ? ', true' : ''});`];
    } else if (action instanceof microflows.ExportXmlAction) {
        return ["ExportXmlAction();"];
    } else if (action instanceof microflows.GenerateDocumentAction) {
        return ["GenerateDocumentAction();"];
    } else if (action instanceof microflows.ImportXmlAction) {
        return ["ImportXmlAction();"];
    } else if (action instanceof microflows.JavaActionCallAction) {
        if (action.javaActionQualifiedName !== null) {
            const javaActionQualifiedName = ju.getQualifiedNameJavaActionFromString(action.javaActionQualifiedName);
            const javaAction = model.findJavaActionByQualifiedName(action.javaActionQualifiedName);
            var returnType = 'Boolean';
            if (javaAction) {
                returnType = getReturnTypeOfJavaAction(javaAction.asLoaded());
            }
            variables[action.outputVariableName] = returnType;
            return [action.outputVariableName + ' = ' + javaActionQualifiedName + '.execute(' + action.parameterMappings.map(x => getJavaActionParameterValueString(x.value, model)).join(', ') + ');'];
        }
        throw  `No java action type set/found for ${action.toJSON()}`;
    } else if (action instanceof microflows.ListOperationAction) {
        var type;
        var mfOperation;

        const operation = action.operation;
        if (operation === null) {
            throw  `No list operation set/found for ${action.toJSON()}`; 
        }
        if (operation instanceof microflows.Head || operation instanceof microflows.Tail) {
            type = `Object`;
            mfOperation = `SelectListOperationAction`;
        } else if (operation instanceof microflows.Sort) {
            type = variables[operation.listVariableName];
            mfOperation = `ListOperationAction`;
        } else if (operation instanceof microflows.BinaryListOperation) {
            if (operation instanceof microflows.Contains || operation instanceof microflows.ListEquals) {
                type = 'Boolean';
                mfOperation = `BooleanListOperationAction`;
            } else if (operation instanceof microflows.Intersect || operation instanceof microflows.Subtract || operation instanceof microflows.Union) {
                type = variables[operation.listVariableName];
                mfOperation = `ListOperationAction`;
            } else {
                throw `Unrecognized BinaryListOperation: ${operation.structureTypeName}`;
            }
        } else if (operation instanceof microflows.InspectAttribute) {
            if (operation instanceof microflows.Filter) {
                type = variables[operation.listVariableName];
                mfOperation = `ListOperationAction`;
            } else if (operation instanceof microflows.Find) {
                type = variables[operation.listVariableName].replace('java.util.List<', '').replace('>', '');
                mfOperation = `SelectListOperationAction`;
            } else {
                throw `Unrecognized InspectAttribute operation: ${operation.structureTypeName}`;
            }
        } else {
            throw `Unrecognized operation: ${operation.structureTypeName}`;
        }

        if (action.outputVariableName) {
            variables[action.outputVariableName] = type;
            return [`${action.outputVariableName} = ${mfOperation}(${parseMxExpression(operation.listVariableName, model) });`];
        } else {
            return [`ListOperationAction();`];
        }
    } else if (action instanceof microflows.LogMessageAction) {
        return [`MXCore.log(${parseMxExpression(action.node, model) }, "${action.level}", "${action.messageTemplate.text.replace(/[\r\n]/g, ' ').replace(/\s\+/g, ' ') }");`];
    } else if (action instanceof microflows.MicroflowCallAction) {
        if (action.microflowCall.microflowQualifiedName === null) {
            throw  `No microflow set/found for ${action.toJSON()}`; 
        }
        var returnType = 'void';
        var otherMF = model.findMicroflowByQualifiedName(action.microflowCall.microflowQualifiedName);
        if (otherMF) {
            var otherMFasLoaded = otherMF.asLoaded();
            returnType = getReturnTypeOfMicroflow(otherMFasLoaded);
        }
        

        if (action.outputVariableName && returnType !== 'void') {
            variables[action.outputVariableName] = returnType;
        }
        return [(action.outputVariableName && returnType !== 'void' ? action.outputVariableName + ' = ' : '') + action.microflowCall.microflowQualifiedName.replace('.', '.logic.') + '.execute(' + action.microflowCall.parameterMappings.map(x => parseMxExpression(x.argument, model)).join(', ') + ');'];
    } else if (action instanceof microflows.RetrieveAction) {
        var source = action.retrieveSource;
        var bla;
        var type;
        var range: microflows.Range;
        var single = false;
        var set = false;
        if (source instanceof microflows.AssociationRetrieveSource) {
            if (source.association === null || source.associationQualifiedName === null) {
                throw  `No association set/found for ${source.toJSON()}`;
            }
            if (source.associationQualifiedName.indexOf('System.') === 0) {
                bla = `${source.startVariableName}.get${source.associationQualifiedName.split('.')[1]}();`
                type = `MXSystem.domain.UserRole`; // TODO
            } else {
                bla = `${source.startVariableName}.get${source.association.name}();`;

                const a = source.association.asLoaded();
                if (a.type === domainmodels.AssociationType.ReferenceSet)
                    single = false;
                else if (a.type === domainmodels.AssociationType.Reference)
                    single = true;
                else
                    throw 'dsdas';
                if (a instanceof domainmodels.CrossAssociation && a.child.qualifiedName !== null) {
                    type = ju.getQualifiedNameEntityFromString(a.child.qualifiedName);
                } else if (a instanceof domainmodels.Association && a.child.qualifiedName !== null) {
                    type = ju.getQualifiedNameEntityFromString(a.child.qualifiedName);
                }
            }
        } else if (source instanceof microflows.DatabaseRetrieveSource) {
            if (source.entityQualifiedName === null) {
                throw  `No entity set/found for ${source.toJSON()}`;
            }
            const range = source.range;
            const splitted = source.entityQualifiedName.split('.');
            const moduleName = splitted[0] === 'System' ? 'MXSystem' : splitted[0];
            const entityName = splitted[1];
            bla = `core.MXData.retrieve${moduleName}${entityName}ByXPath("${source.xPathConstraint.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ') }");`;
            type = ju.getQualifiedNameEntityFromString(source.entityQualifiedName);
            if (range instanceof microflows.CustomRange) {
                //                bla += ' limit = ' + (<microflows.CustomRange>range).limitExpression;
                //                bla += ' offset = ' + (<microflows.CustomRange>range).offsetExpression;
                throw 'Not yet implemented...';
            } else if (range instanceof microflows.ConstantRange) {
                if ((<microflows.ConstantRange>range).singleObject) {
                    single = true;
                    bla = bla.replace(';', '.get(0);');
                }
            }
        }
        if (type === undefined) {
            throw  `No entity type set/found for ${action.toJSON()}`;
        }
        if (!single) {
            type = `java.util.${set ? 'Set' : 'List'}<${type}>`;
        }
        if (action.outputVariableName !== null) {
            variables[action.outputVariableName] = type;
            return [action.outputVariableName + ' = ' + bla];
        }
        throw `No output variable found for action: ${action}`;
    } else if (action instanceof microflows.RollbackAction) {
        return ["MXCore.rollBack();"];
    } else if (action instanceof microflows.ShowHomePageAction) {
        return ["MXClient.showUserHomePage();"];
    } else if (action instanceof microflows.ShowMessageAction) {
        return ['MXClient.showMessage(' + formattingExpression(action.template, model) + ', ' + (action.blocking ? 'true' : 'false') + ');'];
    } else if (action instanceof microflows.ShowPageAction) {
        let pageTitle = null;
        if (action.pageSettings.formTitle) {
            const page = action.pageSettings.formTitle.translations.find(t => t.languageCode === 'en_US');
            if (page && page.text) {
                pageTitle = `"${page.text}"`;
            }
        }

        return [`MXClient.showPage("${action.pageSettings.pageQualifiedName}", ${pageTitle});`];
    } else if (action instanceof microflows.ValidationFeedbackAction) {
        return ["MXClient.validationFeedbackAction();"];
    }
    throw 'not recognized action type: ' + action.structureTypeName;
}

function formattingExpression(template: microflows.TextTemplate, model: IModel): string {
    const templateText = template.text.translations.find(t => t.languageCode === 'en_US');
    if (templateText && templateText.text) {
        const messageTemplate = parseMxExpression(templateText.text, model);
        const paramList = template.arguments.map(a => parseMxExpression(a.expression, model)).join(', ');

        let formattingExpression;
        if (paramList.length === 0) {
            formattingExpression = `"${messageTemplate}"`;
        } else {
            formattingExpression = `formatTemplate("${messageTemplate}", ${paramList})`;
        }

        return formattingExpression;
    }
    throw `No English text template found for Text Template: ${template.toJSON()}`;
}

function getLineRepresentation(microflowObject: microflows.MicroflowObject, model: IModel): string[] {
    if (microflowObject instanceof microflows.StartEvent) {
        return [];
    } else if (microflowObject instanceof microflows.ActionActivity) {
        if (microflowObject.action) {
            return getLineRepresentationOfAction(microflowObject.action, model);
        }
        throw `No action activity found for microflow obect: ${microflowObject.toJSON()}`
    } else if (microflowObject instanceof microflows.Annotation) {
        var annotation = <microflows.Annotation>microflowObject;
        return annotation.caption.replace(/\r/g, '').split('\n').map(x => '// ' + x);
    } else if (microflowObject instanceof microflows.BreakEvent) {
        return ["break;"];
    } else if (microflowObject instanceof microflows.ContinueEvent) {
        return ["continue;"];
    } else if (microflowObject instanceof microflows.EndEvent) {
        const c = microflowObject.container.container;
        if (c instanceof microflows.MicroflowBase && c.microflowReturnType && !(c.microflowReturnType instanceof datatypes.VoidType)) {
            return [`return ${parseMxExpression(microflowObject.returnValue, model) };`];
        } else {
            return ['return;'];
        }
    } else if (microflowObject instanceof microflows.ErrorEvent) {
        return ['throw new RuntimeException();'];  // TODO reference inner exception with indent level
    } else if (microflowObject instanceof microflows.ExclusiveMerge) {
        return [];
    } else if (microflowObject instanceof microflows.MicroflowParameterObject) {
        const type = ju.dataTypeToJavaType(microflowObject.variableType);
        variables[microflowObject.name] = type;
        return [type + ' ' + microflowObject.name];
    } else if (microflowObject instanceof microflows.ExclusiveSplit) {
        throw 'not supposed to be handled here, syntax thing';
    } else if (microflowObject instanceof microflows.InheritanceSplit) {
        throw 'not supposed to be handled here, syntax thing';
    } else if (microflowObject instanceof microflows.LoopedActivity) {
        throw 'not supposed to be handled here, syntax thing';
    } else {
        throw "unknown element: " + microflowObject.structureTypeName;
    }
}


function logIndent(indent: number, message: string) {
    return (Array(indent + 1).join('\t') + message);
}


function getMicroflowParameterLine(microflow: microflows.MicroflowBase, model: IModel): string {
    var result: string[] = [];
    microflow.objectCollection.objects.filter(o => o instanceof microflows.MicroflowParameterObject).forEach((o) => {
        result = result.concat(getLineRepresentation(o, model));
    });
    return result.join(', ');
}


function microflowToText(microflow: microflows.MicroflowBase, model: IModel): string[] {
    var resultStrings: string[] = [];
    var startEvent: microflows.StartEvent = microflow.objectCollection.objects.filter(o => o instanceof microflows.StartEvent)[0];

    var annotations: { [originid: string]: microflows.AnnotationFlow[] } = {};
    var flows: { [originid: string]: microflows.SequenceFlow[] } = {};
    var flowsReversed: { [originid: string]: microflows.SequenceFlow[] } = {};

    microflow.flows.forEach(f => {
        if (f instanceof microflows.SequenceFlow) {
            if (!(f.destination.id in flowsReversed))
                flowsReversed[f.destination.id] = [];
            flowsReversed[f.destination.id].push(f);
            if (!(f.origin.id in flows))
                flows[f.origin.id] = [];
            flows[f.origin.id].push(f);
        } else if (f instanceof microflows.AnnotationFlow) {
            if (!(f.destination.id in annotations)) {
                annotations[f.destination.id] = [];
            }
            annotations[f.destination.id].push(f);
            if (!(f.origin.id in annotations)) {
                annotations[f.origin.id] = [];
            }
            annotations[f.origin.id].push(f);
        }
    });

    var visited: {[index: string]: boolean} = {};

    function startWalkingBoots(currentEvent: microflows.MicroflowObject, indent: number, breakOnMerges = true): microflows.ExclusiveMerge[] {
        if (currentEvent instanceof microflows.ExclusiveMerge && breakOnMerges && flowsReversed[currentEvent.id].length > 1) {
            return [currentEvent];
        }
        if (currentEvent.id in visited) {
            resultStrings.push('WARNING, BEEN HERE BEFORE ' + currentEvent.structureTypeName);
        }
        visited[currentEvent.id] = true;

        if (currentEvent.id in annotations) {
            annotations[currentEvent.id].forEach((annotation) => {
                if (currentEvent == annotation.destination)
                    getLineRepresentation(annotation.origin, model).forEach(line => {
                        resultStrings.push(logIndent(indent, line));
                    });
                else
                    getLineRepresentation(annotation.destination, model).forEach(line => {
                        resultStrings.push(logIndent(indent, line));
                    });
            });
        }

        function displayBlock(currentEvent: microflows.MicroflowObject, indent: number) {
            if (currentEvent instanceof microflows.LoopedActivity) {
                resultStrings.push(logIndent(indent, `for (${variables[currentEvent.iteratedListVariableName].replace('java.util.List<', '').replace('>', '') } ${currentEvent.loopVariableName} : ${currentEvent.iteratedListVariableName}) {`)); // TODO: lookup correct variable type
                var loop = (<microflows.LoopedActivity>currentEvent);
                var nextItems = loop.objectCollection.objects.filter(x => !(x.id in flowsReversed || x instanceof microflows.Annotation));

                if (nextItems.length != 1) {
                    throw "Loop in microflow " + microflow.qualifiedName + " has more than one entry point";
                }
                var unfinishedMerges = startWalkingBoots(nextItems[0], indent + 1);
                if (unfinishedMerges.length > 0) {
                    throw 'nested microflow has unfinishedMerges';
                }
                resultStrings.push(logIndent(indent, '}'));
            } else {
                var msg = getLineRepresentation(currentEvent, model);
                if (msg) {
                    msg.forEach(line => {
                        resultStrings.push(logIndent(indent, line));
                    });
                }
            }
        }


        function resolveUnresolvedMerges(merges: microflows.ExclusiveMerge[], indent: number) {
            var visits: {[index: string]: number} = {};
            var incomingFlowCounts: {[index: string]: number} = {};
            var mergeidtomerge: {[index: string]: microflows.ExclusiveMerge} = {};
            merges.forEach(merge => {
                if (!(merge.id in visits))
                    visits[merge.id] = 0;
                visits[merge.id] += 1;
                incomingFlowCounts[merge.id] = flowsReversed[merge.id].length;
                mergeidtomerge[merge.id] = merge;
            });
            var remainingUnresolvedFlows: microflows.ExclusiveMerge[] = [];
            for (var mergeid in visits) {
                if (visits[mergeid] == incomingFlowCounts[mergeid]) {
                    if (mergeid in flows) {
                        startWalkingBoots(flows[mergeid][0].destination, indent).forEach(x => {
                            remainingUnresolvedFlows.push(x);
                        });
                    }
                } else {
                    for (var i = 0; i < visits[mergeid]; i++) {
                        remainingUnresolvedFlows.push(mergeidtomerge[mergeid]);
                    }
                }
            }
            return remainingUnresolvedFlows;
        }


        if (!(currentEvent.id in flows)) {
            // final destination
            displayBlock(currentEvent, indent);
            return [];
        } else {
            if (flows[currentEvent.id].length == 1) {
                // one-way
                displayBlock(currentEvent, indent);
                var z = startWalkingBoots(flows[currentEvent.id][0].destination, indent);
                return z;
            } else if (flows[currentEvent.id].length == 2 && flows[currentEvent.id].filter(x => x.isErrorHandler).length > 0) {

                // two way try/catch
                resultStrings.push(logIndent(indent, 'try {'));
                displayBlock(currentEvent, indent + 1);
                resultStrings.push(logIndent(indent, `} catch (Exception e${indent}) {`));
                var exceptionHandler = flows[currentEvent.id].filter(x => x.isErrorHandler)[0].destination;
                var unfinishedMergesInCatch = startWalkingBoots(exceptionHandler, indent + 1);
                if (unfinishedMergesInCatch.length == 1) {
                    // block has to be duplicated and inlined, need to remove this merge from the next unfinishedMerges block
                    var unfinishedMergesAfterInlining = startWalkingBoots(unfinishedMergesInCatch[0], indent + 1, breakOnMerges = false);
                    if (unfinishedMergesAfterInlining.length > 0) {
                        throw 'unresolved merges remain after inlining, can not handle this';
                    }
                } else if (unfinishedMergesInCatch.length > 1) {
                    throw 'Can not resolve multiple unfinished merges in catch block';
                }
                resultStrings.push(logIndent(indent, '}'));
                var nextFlow = flows[currentEvent.id].filter(x => !x.isErrorHandler)[0].destination;
                var unfinishedMergesAfterTryCatch = startWalkingBoots(nextFlow, indent);
                if (unfinishedMergesAfterTryCatch.length == unfinishedMergesInCatch.length && unfinishedMergesAfterTryCatch.length == 1 && unfinishedMergesInCatch[0] == unfinishedMergesAfterTryCatch[0]) {
                    return startWalkingBoots(unfinishedMergesAfterTryCatch[0], indent, breakOnMerges = false);
                } else {
                    return unfinishedMergesAfterTryCatch;
                }

            } else if (currentEvent instanceof microflows.ExclusiveSplit && flows[currentEvent.id].filter(x => !((<microflows.EnumerationCase>(x.caseValue)).value in { 'true': 1, 'false': 1 })).length > 0) {
                //enumeration split value
                resultStrings.push(logIndent(indent, 'switch (' + (<microflows.ExpressionSplitCondition>currentEvent.splitCondition).expression + ') {'));
                var destinations: { [destinationid: string]: microflows.SequenceFlow[] } = {};
                flows[currentEvent.id].forEach(x => {
                    if (!(x.destination.id in destinations)) {
                        destinations[x.destination.id] = [];
                    }
                    destinations[x.destination.id].push(x);
                });
                var unfinishedMerges: microflows.ExclusiveMerge[] = [];
                for (var x in destinations) {
                    resultStrings.push(logIndent(indent + 1, '(' + destinations[x].map(l => (<microflows.EnumerationCase>l.caseValue).value).join(' || ') + ') {'));
                    startWalkingBoots(destinations[x][0].destination, indent + 2, breakOnMerges = (destinations[x].length != flowsReversed[destinations[x][0].destination.id].length)).forEach(u => {
                        unfinishedMerges.push(u);
                        if (destinations[x][0].destination instanceof microflows.ExclusiveMerge && destinations[x].length != flowsReversed[destinations[x][0].destination.id].length) {
                            for (var i = 1; i < destinations[x].length; i++) {
                                unfinishedMerges.push(u);
                            }
                        }
                    });
                    resultStrings.push(logIndent(indent + 1, '},'));
                };
                resultStrings.push(logIndent(indent, '}'));
                return resolveUnresolvedMerges(unfinishedMerges, indent);
            } else if (currentEvent instanceof microflows.InheritanceSplit) {
                // inheritance split
                var destinations: { [destinationid: string]: microflows.SequenceFlow[] } = {};
                flows[currentEvent.id].forEach(x => {
                    if (!(x.destination.id in destinations)) {
                        destinations[x.destination.id] = [];
                    }
                    destinations[x.destination.id].push(x);
                });
                var unfinishedMerges: microflows.ExclusiveMerge[] = [];
                var counter = 0;
                for (var x in destinations) {
                    var prefix = counter === 0 ?  '' : 'else ';
                    resultStrings.push(logIndent(indent, prefix + 'if (' + currentEvent.splitVariableName + ' instanceof ' + destinations[x].map(l => {
                        const inheritanceCase:microflows.InheritanceCase = <microflows.InheritanceCase>l.caseValue;
                        if (inheritanceCase.valueQualifiedName !== null) {
                            return ju.getQualifiedNameEntityFromString(inheritanceCase.valueQualifiedName);
                        }
                        throw `No entity found to compare against in Inheritance Split: ${currentEvent.toJSON()}`;
                    }).join(' | ') + ') {') );
                    startWalkingBoots(destinations[x][0].destination, indent + 1, breakOnMerges = (destinations[x].length != flowsReversed[destinations[x][0].destination.id].length)).forEach(u => {
                        unfinishedMerges.push(u);
                        if (destinations[x][0].destination instanceof microflows.ExclusiveMerge && destinations[x].length != flowsReversed[destinations[x][0].destination.id].length) {
                            for (var i = 1; i < destinations[x].length; i++) {
                                unfinishedMerges.push(u);
                            }
                        }
                    });
                    resultStrings.push(logIndent(indent, '}'));
                    counter++;
                };
                return resolveUnresolvedMerges(unfinishedMerges, indent);
            } else if (currentEvent instanceof microflows.ExclusiveSplit && flows[currentEvent.id].filter(x => !((<microflows.EnumerationCase>(x.caseValue)).value in { 'true': 1, 'false': 1 })).length == 0) {
                // true/false split
                var trueHandler = flows[currentEvent.id].filter(x => (<microflows.EnumerationCase>x.caseValue).value == 'true')[0];
                var falseHandler = flows[currentEvent.id].filter(x => (<microflows.EnumerationCase>x.caseValue).value == 'false')[0];
                var unfinishedMerges: microflows.ExclusiveMerge[] = [];
                var conditionCaption = '';
                var condition = currentEvent.splitCondition;

                if (condition instanceof microflows.ExpressionSplitCondition) {
                    conditionCaption = (<microflows.ExpressionSplitCondition>condition).expression;
                } else if (condition instanceof microflows.RuleSplitCondition) {
                    if (condition.ruleCall.ruleQualifiedName === null) {
                        throw `No qualified name defined for Rule: ${condition.ruleCall.toJSON()}`;
                    }
                    const paramList = condition.ruleCall.parameterMappings.map(x => parseMxExpression(x.argument, model)).join(', ');
                    conditionCaption = `${condition.ruleCall.ruleQualifiedName.split('.').join('.logic.') }.execute(${paramList})`;
                }
                resultStrings.push(logIndent(indent, `if (${parseMxExpression(conditionCaption, model) }) {`));
                startWalkingBoots(trueHandler.destination, indent + 1).forEach(u => {
                    unfinishedMerges.push(u);
                });
                resultStrings.push(logIndent(indent, '} else {'));
                startWalkingBoots(falseHandler.destination, indent + 1).forEach(u => {
                    unfinishedMerges.push(u);
                });
                resultStrings.push(logIndent(indent, '}'));
                var result = resolveUnresolvedMerges(unfinishedMerges, indent);
                return result;

            }
        }
        throw 'woah, you think you can exit without returning a list of unfinished merges?';
    }
    try {
        var unfinishedMerges = startWalkingBoots(startEvent, 0);
        if (unfinishedMerges.length > 0) {
            resultStrings.push('unfinished merges!!');
        }
    } catch (e) {
        resultStrings.push('unfinished merges!! ' + e);
    }

    return resultStrings;
}
