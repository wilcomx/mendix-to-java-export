import { microflows, enumerations, domainmodels, appservices, webservices, javaactions, codeactions, datatypes, texts, IModel } from "mendixmodelsdk";

export namespace javautils {
    const javaPackageEntity: string = 'domain';
    const javaPackageMicroflow: string = 'logic';
    const javaPackageRule: string = javaPackageMicroflow;
    const javaPackageEnumeration: string = 'enumeration';
    const javaPackageConsumedAppService: string = 'appservice';
    const javaPackageImportedWebService: string = 'webservice';
    const javaPackageJavaAction: string = 'javaaction';

    const javaTypeBoolean: string = 'Boolean';
    const javaTypeDateTime: string = 'java.util.Date';
    const javaTypeDecimal: string = 'java.math.BigDecimal';
    const javaTypeLong: string = 'Long';
    const javaTypeInteger: string = 'Integer';
    const javaTypeString: string = 'String';
    const javaTypeFloat: string = 'Float';
    const javaTypeObject: string = 'Object';
    const javaTypeVoid: string = 'void';
    const javaTypeList: string = 'java.util.List';

    // Microflow
    export function getPackageMicroflow(microflow: microflows.MicroflowBase): string {
        if (microflow.qualifiedName !== null) {
            return getPackage(microflow.qualifiedName) + '.' + javaPackageMicroflow;
        }
        throw `Mircoflow has no qualified name: ${microflow.toJSON()}`;
    }
    
    export function getQualifiedNameMicroflow(microflow: microflows.MicroflowBase): string {
        return getPackageMicroflow(microflow) + '.' + getNameMicroflow(microflow);
    }

    export function getNameMicroflow(microflow: microflows.MicroflowBase): string {
        return parseName(microflow.name, JavaName.CLASS_NAME);
    }

    export function getQualifiedNameMicroflowFromString(microflowQualifiedName: string): string {
        return getQualifiedNameFromString(microflowQualifiedName, javaPackageMicroflow);
    }

    // Rule
    export function getPackageRule(rule: microflows.Rule): string {
        if (rule.qualifiedName !== null) {
            return getPackage(rule.qualifiedName) + '.' + javaPackageRule;
        }
        throw `Mircoflow has no qualified name: ${rule.toJSON()}`;
    }
    
    export function getQualifiedNameRule(rule: microflows.Rule): string {
        return getPackageRule(rule) + '.' + getNameRule(rule);
    }

    export function getNameRule(rule: microflows.Rule): string {
        return parseName(rule.name, JavaName.CLASS_NAME);
    }

    export function getQualifiedNameRuleFromString(ruleQualifiedName: string): string {
        return getQualifiedNameFromString(ruleQualifiedName, javaPackageRule);
    }

    // Enumeration
    export function getPackageEnumeration(enumeration: enumerations.IEnumeration): string {
        if (enumeration.qualifiedName !== null) {
            return getPackage(enumeration.qualifiedName) + '.' + javaPackageEnumeration;
        }
        throw `Enumeration has no qualified name: ${enumeration.toJSON()}`;
    }
    
    export function getQualifiedNameEnumeration(enumeration: enumerations.IEnumeration): string {
        return getPackageEnumeration(enumeration) + '.' + getNameEnumeration(enumeration);
    }

    export function getNameEnumeration(enumeration: enumerations.IEnumeration): string {
        return parseName(enumeration.name, JavaName.CLASS_NAME);
    }
    
    // Entity
    export function getPackageEntity(entity: domainmodels.IEntity): string {
        if (entity.qualifiedName !== null) {
            return getPackage(entity.qualifiedName) + '.' + javaPackageEntity;
        }
        throw `Entity has no qualified name: ${entity.toJSON()}`;
    }
    
    export function getQualifiedNameEntity(entity: domainmodels.IEntity): string {
        return getPackageEntity(entity) + '.' + getNameEntity(entity);
    }

    export function getNameEntity(entity: domainmodels.IEntity): string {
        return parseName(entity.name, JavaName.CLASS_NAME);
    }
    
    export function getQualifiedNameEntityFromString(entityQualifiedName: string): string {
        return getQualifiedNameFromString(entityQualifiedName, javaPackageEntity);
    }

    export function getModuleEntity(entity: domainmodels.IEntity): string {
        if (entity.qualifiedName !== null) {
            return getModule(entity.qualifiedName);
        }
        throw `Entity has no qualified name: ${entity.toJSON()}`;
    }
    
    // Consumed app service
    export function getPackageConsumedAppService(consumedAppService: appservices.IConsumedAppService): string {
        if (consumedAppService.qualifiedName !== null) {
            return getPackage(consumedAppService.qualifiedName) + '.' + javaPackageConsumedAppService;
        }
        throw `Consumed App Service has no qualified name: ${consumedAppService.toJSON()}`;
    }
    
    export function getQualifiedNameConsumedAppService(consumedAppService: appservices.IConsumedAppService): string {
        return getPackageConsumedAppService(consumedAppService) + '.' + getNameConsumedAppService(consumedAppService);
    }

    export function getNameConsumedAppService(consumedAppService: appservices.IConsumedAppService): string {
        return parseName(consumedAppService.name, JavaName.CLASS_NAME);
    }

    // Imported web service
    export function getPackageImportedWebService(importedWebService: webservices.IImportedWebService): string {
        if (importedWebService.qualifiedName !== null) {
            return getPackage(importedWebService.qualifiedName) + '.' + javaPackageImportedWebService;
        }
        throw `Imported Web Service has no qualified name: ${importedWebService.toJSON()}`;
    }
    
    export function getQualifiedNameImportedWebService(importedWebService: webservices.IImportedWebService): string {
        return getPackageImportedWebService(importedWebService) + '.' + getNameImportedWebService(importedWebService);
    }

    export function getNameImportedWebService(importedWebService: webservices.IImportedWebService): string {
        return parseName(importedWebService.name, JavaName.CLASS_NAME);
    }
    
    // Java action
    export function getPackageJavaAction(javaAction: javaactions.IJavaAction): string {
        if (javaAction.qualifiedName !== null) {
            return getPackage(javaAction.qualifiedName) + '.' + javaPackageJavaAction;
        }
        throw `Java Action has no qualified name: ${javaAction.toJSON()}`;
    }
    
    export function getQualifiedNameJavaAction(javaAction: javaactions.IJavaAction): string {
        return getPackageJavaAction(javaAction) + '.' + getNameJavaAction(javaAction);
    }

    export function getNameJavaAction(javaAction: javaactions.IJavaAction): string {
        return parseName(javaAction.name, JavaName.CLASS_NAME);
    }
    
    export function getQualifiedNameJavaActionFromString(javaActionQualifiedName: string): string {
        return getQualifiedNameFromString(javaActionQualifiedName, javaPackageJavaAction);
    }

    // Association
    export function getPackageAssociation(association: domainmodels.IAssociation): string {
        if (association.qualifiedName !== null) {
            return getPackage(association.qualifiedName) + '.' + javaPackageEntity;
        }
        throw `Association has no qualified name: ${association.toJSON()}`;
    }
    
    export function getQualifiedNameAssociation(association: domainmodels.IAssociation): string {
        return getPackageAssociation(association) + '.' + getNameAssociation(association);
    }

    export function getNameAssociation(association: domainmodels.IAssociation): string {
        return parseName(association.name, JavaName.CLASS_NAME);
    }

    export function getQualifiedNameAssociationFromString(associationQualifiedName: string): string {
        return getQualifiedNameFromString(associationQualifiedName, javaPackageEntity);
    }

    export function getNameFromString(qualifiedName: string): string {
        return getName(qualifiedName);
    }
    
    function getPackage(qualifiedName: string): string {
        var moduleName: string = getModule(qualifiedName);
        if (moduleName === 'System') {
            moduleName = 'MX' + moduleName;
        }
        return moduleName.toLowerCase();
    }
    
    function getModule(qualifiedName: string): string {
        return qualifiedName.substr(0, qualifiedName.lastIndexOf('.'));
    }
    
    function getName(qualifiedName: string): string {
        return parseName(qualifiedName.substr(qualifiedName.lastIndexOf('.') + 1), JavaName.CLASS_NAME);
    }
    
    function getQualifiedNameFromString(qualifiedName: string, javaPackage: string): string {
        return `${getPackage(qualifiedName)}.${javaPackage}.${getName(qualifiedName)}`;
    }
    
    export function attributeTypeToJavaType(type: domainmodels.IAttributeType): string {
        if (type instanceof domainmodels.AutoNumberAttributeType) {
            return javaTypeLong;
        } else if (type instanceof domainmodels.BooleanAttributeType) {
            return javaTypeBoolean;
        } else if (type instanceof domainmodels.DateTimeAttributeType) {
            return javaTypeDateTime;
        } else if (type instanceof domainmodels.EnumerationAttributeType) {
            if (type.enumerationQualifiedName.startsWith('System.')) {
                return type.enumerationQualifiedName.replace('System.', 'mxsystem.enumeration.');
            }
            return `${getPackageEnumeration(type.enumeration)}.${type.enumeration.name}`;
        } else if (type instanceof domainmodels.LongAttributeType) {
            return javaTypeLong;
        } else if (type instanceof domainmodels.IntegerAttributeType) {
            return javaTypeInteger;
        }else if (type instanceof domainmodels.StringAttributeType) {
            return javaTypeString;
        } else if (type instanceof domainmodels.DecimalAttributeType) {
            return javaTypeDecimal;
        } else if (type instanceof domainmodels.FloatAttributeType) {
            return javaTypeFloat;
        } else {
            throw `Unhandled attribute type (domainmodels.IAttributeType): ${type.toJSON()}`;
        }
    }
    
    export function dataTypeToJavaType(dataType: datatypes.IDataType): string {
        if (dataType instanceof datatypes.BooleanType) {
            return javaTypeBoolean;
        } else if (dataType instanceof datatypes.DateTimeType) {
            return javaTypeDateTime;
        } else if (dataType instanceof datatypes.DecimalType) {
            return javaTypeDecimal;
        } else if (dataType instanceof datatypes.EmptyType) {
            return javaTypeVoid;
        } else if (dataType instanceof datatypes.EnumerationType) {
            const enumeration = dataType.enumeration;
            return getPackageEnumeration(enumeration) + '.' + enumeration.name;
        } else if (dataType instanceof datatypes.FloatType) {
            return javaTypeFloat;
        } else if (dataType instanceof datatypes.IntegerType) {
            return javaTypeInteger;
        } else if (dataType instanceof datatypes.ListType) {
            return `${javaTypeList}<${getQualifiedNameEntityFromString(dataType.entityQualifiedName)}>`;
        } else if (dataType instanceof datatypes.ObjectType) {
            return getQualifiedNameEntityFromString(dataType.entityQualifiedName);
        } else if (dataType instanceof datatypes.EntityType) {
            return getQualifiedNameEntityFromString(dataType.entityQualifiedName);
        } else if (dataType instanceof datatypes.StringType) {
            return javaTypeString;
        } else if (dataType instanceof datatypes.UnknownType) {
            return javaTypeObject;
        } else if (dataType instanceof datatypes.VoidType) {
            return javaTypeVoid;
        } else {
            throw `Unhandled data type (datatypes.DataType): ${dataType.toJSON()}`;
        }
    }
    
    export function typeToJavaType(type: codeactions.Type): string {
        if (type instanceof codeactions.BooleanType) {
            return javaTypeBoolean;
        } else if (type instanceof codeactions.DateTimeType) {
            return javaTypeDateTime;
        } else if (type instanceof codeactions.DecimalType) {
            return javaTypeDecimal;
        } else if (type instanceof codeactions.ConcreteEntityType) {
            return getQualifiedNameEntityFromString(type.entityQualifiedName);
        } else if (type instanceof codeactions.EnumerationType) {
            const enumeration = type.enumeration;
            return getPackageEnumeration(enumeration) + '.' + enumeration.name;
        } else if (type instanceof codeactions.FloatType) {
            return javaTypeFloat;
        } else if (type instanceof codeactions.IntegerType) {
            return javaTypeInteger;
        } else if (type instanceof codeactions.StringType) {
            return javaTypeString;
        } else if (type instanceof codeactions.ListType) {
            return javaTypeList;
        } else if (type instanceof codeactions.ParameterizedEntityType) {
            return 'Object';
        } else {
            throw `Unhandled data type (codeactions.Type): ${type.structureTypeName}`;
        }
    }

    export function parameterTypeToJavaType(parameterType: codeactions.ParameterType) {
        if (parameterType instanceof codeactions.BasicParameterType) {
            return typeToJavaType(parameterType.type);
        }
        throw `Unhandled data type (codeactions.Type): ${parameterType.structureTypeName}`;
    }

    export function parseName(name: string, nameType: JavaName, isArgument: boolean=false): string {
        let charAt: number = isArgument ? 1 : 0;
        let slice: number = isArgument ? 2 : 1;
        switch(nameType) {
            case JavaName.CLASS_NAME:
                return name.charAt(charAt).toUpperCase() + name.slice(slice);
            case JavaName.METHOD_NAME:
                return name.charAt(charAt).toLowerCase() + name.slice(slice);
            case JavaName.STATIC_FINAL_MEMBER:
                return name.toUpperCase();
            case JavaName.MEMBER:
                return name.charAt(charAt).toLowerCase() + name.slice(slice);
        }
    }

    export enum JavaName {
        CLASS_NAME,
        METHOD_NAME,
        STATIC_FINAL_MEMBER,
        MEMBER
    }

    export function parseMxExpression(input: string, model: IModel): string {
        input = input.replace(/\$\w+/g, (match) => { return '$' + parseName(match.substring(1), JavaName.MEMBER) });
        
        input = input.replace(/\(/g, '( ').replace(/\)/g, ' )');
        input = (' ' + input + ' ').replace(/\$/g, '').replace(/'/g, '"').replace(/\n/g, ' ').replace(/\r/g, '').replace(/\s+/g, ' ').replace(/\sand\s/g, ' && ').replace(/\sor\s/g, ' || ').replace(/if\s/g, '').replace(/\s?then\s?/g, ' ? ').replace(/\s?else\s?/g, ' : ').replace(/\sempty\s/g, ' null ').replace(/\s=\s/g, ' == ').replace(/\s([0-9]+)\s/g, function(m, m1) { return ' ' + m1 + 'l ' });
        if (input.indexOf('@') !== -1) {
            model.allConstants().map(c => c.asLoaded()).forEach(constant => {
                input = input.replace(`@${constant.qualifiedName}`, `core.MXCore.get${dataTypeToJavaType(constant.type)}Constant("${constant.qualifiedName}")`);
            });
        }
        input = input.replace(/\[%CurrentDateTime%\]/g, 'new java.util.Date()');
        input = input.replace(/\s([a-zA-Z0-9_]+)\/[a-zA-Z0-9]+\.([a-zA-Z0-9_]+)\s/g, function(m, m1, m2) {
            return ` ${parseName(m1, JavaName.MEMBER)}.get${m2}() `;
        });
        input = input.replace(/\s([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)\s/g, function(m, m1, m2) {
            return ` ${parseName(m1, JavaName.MEMBER)}.get${m2}() `;
        });
        // The next one fixes arguments to formatDateTime, but also just happily replaces anything in a string literal. Not good.
        input = input.replace(/([a-zA-Z0-9_]+)\/([a-zA-Z0-9_]+)/g, function(m, m1, m2) {
            return ` ${parseName(m1, JavaName.MEMBER)}.get${m2}() `;
        });
        input = input.replace(/(\[%.*?%\])/g, function(match, n1) {
            return '"' + n1 + '"';
        });
        input = input.replace(/\(\s*/g, '(').replace(/\s*\)/g, ')');
    
        model.allEnumerations()
            .forEach(e => { 
                if (e.qualifiedName !== null) {
                    input = input.replace(e.qualifiedName, getQualifiedNameEnumeration(e))
                }
            });
    
        return input.trim();
    }

    export function parseTemplate(template: microflows.Template, model: IModel): string {
        let messageTemplate: string = '';
        const paramList = template.arguments.map(a => parseMxExpression(a.expression, model)).join(', ');
        if (template instanceof microflows.TextTemplate) {
            const templateText: texts.Translation | undefined = template.text.translations.find(t => t.languageCode === 'en_US');
            if (templateText && templateText.text) {
                messageTemplate = parseMxExpression(templateText.text, model);
            } else {
                throw `No English text template found for Text Template: ` + template.toJSON();
            }
        }  else if (template instanceof microflows.StringTemplate) {
            messageTemplate = template.text;
        } else {
            throw `Unimplemented template type: ${template.structureTypeName}`;
        }
        if (paramList.length === 0) {
            return `"${messageTemplate}"`;
        } else {
            return `core.MXCore.formatTemplate("${messageTemplate}", new String[]{${paramList}})`;
        }
    }

    export function getJavaActionParameterValueString(javaActionParameterValue: microflows.JavaActionParameterValue, model: IModel): string {
        if (javaActionParameterValue instanceof microflows.BasicCodeActionParameterValue) {
            return parseMxExpression(javaActionParameterValue.argument, model)
        } else {
            throw `JavaActionParameterValue type not implemented: ${javaActionParameterValue.toJSON()}`;
        }
    }
}
