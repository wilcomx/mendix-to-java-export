import {IModel, appservices, domainmodels, enumerations, javaactions, codeactions, webservices} from "mendixmodelsdk";
import mf = require('./mf');
import {javautils as ju} from './java/utils';
import fs = require('fs');
import * as _ from 'lodash';
import * as Mustache from 'mustache';

const mxdataTemplate = fs.readFileSync('templates/mxdata.java', 'utf8');
const consumedappsvcTemplate = fs.readFileSync('templates/appsvc.java', 'utf8');
const enumTemplate = fs.readFileSync('templates/enum.java', 'utf8');
const entityTemplate = fs.readFileSync('templates/entity.java', 'utf8');
const javaActionTemplate = fs.readFileSync('templates/javaaction.java', 'utf8');
const websvcTemplate = fs.readFileSync('templates/websvc.java', 'utf8');

export function renderMXData(model: IModel): string {
	const entities: Object[] = [];

	model.allDomainModels().forEach(dm => {
		dm.entities.forEach(e => {
			entities.push({
				packageName: ju.getPackageEntity(e),
				moduleName: ju.getModuleEntity(e),
				name: e.name
			});
		});
	});

	return Mustache.render(mxdataTemplate, {
		entities: entities
	});
}

export function renderConsumedAppService(cas: appservices.ConsumedAppService): string {
	console.log(`=== ${cas.qualifiedName} ===`);

	const entities = cas.msd.domainModel.entities.map(entity => {
		const attributes = entity.attributes.map(a => {
			return {
				attribute: `private ${a.attributeType} ${a.name};`
			};
		})

		const gettersAndSetters = entity.attributes.map(a => {
			return {
				name: a.name,
				type: a.attributeType
			}
		});

		return {
			name: entity.name,
			attributes: attributes,
			gettersAndSetters: gettersAndSetters
		};
	});

	const actions = cas.actions.map(action => {
		let returnType = mf.getType(action.model, action.returnType);

		return {
			name: action.name,
			returnType: returnType,
			paramList: action.parameters.map(p => `${p.type} ${p.name}`).join(', ')
		};
	});

	return Mustache.render(consumedappsvcTemplate, {
		pkg: ju.getPackageConsumedAppService(cas),
		name: cas.name,
		entities: entities,
		actions: actions
	});
}

export function renderImportedWebService(ws: webservices.ImportedWebService): string {
	console.log(`=== ${ws.qualifiedName} ===`);

	const operations: Object[] = [];

	if (ws.wsdlDescription !== null) {
		ws.wsdlDescription.services.forEach(s => {
			s.operations.forEach(o => {
				operations.push({
					name: o.name,
					parameterList: 'Object ... params'
				});
			});
		});
	}	

	return Mustache.render(websvcTemplate, {
		pkg: ju.getPackageImportedWebService(ws),
		name: ws.name,
		operations: operations
	});
}

export function renderEnumeration(enumeration: enumerations.IEnumeration): string {
	console.log(`=== ${enumeration.qualifiedName} ===`);

	return renderEnum(ju.getPackageEnumeration(enumeration), enumeration.name, enumeration.values.map(v => `${v.name}`));
}

export function renderEntity(entity: domainmodels.IEntity, model: IModel): string {
	console.log(`=== ${entity.qualifiedName} ===`);

	const attributes = entity.attributes.map(attribute => {
		return {
			name: attribute.name,
			type: ju.attributeTypeToJavaType(attribute.type)
		};
	});

	const associations: ClassAttribute[] = entity.containerAsDomainModel.associations
		.filter(a => a.parent === entity || a.child === entity)
		.map(a => {
            var single = a.type === domainmodels.AssociationType.Reference;
			return {
				annotation: {
					name: `OneToMany`,
					params: `(mappedBy = "${entity.name}")`
				},
				name: a.name,
				type: single ? `${ju.getQualifiedNameEntity(a.child)}` : `java.util.Set<${ju.getQualifiedNameEntity(a.child)}>`
			}
		});

	const generalization = entity.generalization;
	let superClass = null;
	const imports: Import[] = [];
	if (generalization instanceof domainmodels.Generalization) {
		superClass = ju.getQualifiedNameEntityFromString(generalization.generalizationQualifiedName);
	}

	return renderClass(ju.getPackageEntity(entity), entity.name, imports, superClass, attributes.concat(associations));
}

export function renderMsdEntity(entity: appservices.MsdEntity): string {
	console.log(`=== ${entity.name} ===`);

	return renderClass(entity.containerAsMsdDomainModel.containerAsMsd.containerAsConsumedAppService.name, entity.name, [], null, []);
}

export function renderAssociation(association: domainmodels.IAssociation): string {
	console.log(`=== ${association.qualifiedName} ===`);

	const attributes = [
		{
			annotation: {
				name: `ManyToOne`
			},
			name: association.child.name,
			type: association.child.name
		},
		{
			annotation: {
				name: `ManyToOne`
			},
			name: association.parent.name,
			type: association.parent.name
		}
	];

	return renderClass(ju.getPackageAssociation(association), association.name, [], null, attributes);
}

export function renderJavaAction(ja: javaactions.IJavaAction): string {
	console.log(`=== ${ja.qualifiedName} ===`);

	return Mustache.render(javaActionTemplate, {
		pkg: ju.getPackageJavaAction(ja),
		name: ja.name,
		returnType: ju.typeToJavaType(ja.actionReturnType.asLoaded()),
		paramList: ja.actionParameters.map(jap => `${ju.parameterTypeToJavaType(jap.actionParameterType.asLoaded()) } ${jap.name}`).join(', ')
	});
}

function renderClass(moduleName: string, name: string, imports: Import[], superClass: string | null, attributes: ClassAttribute[]): string {
	const constructorParams = attributes.map(a => `${a.type} ${a.name}`).join(', ');

	return Mustache.render(entityTemplate, {
		moduleName: moduleName,
		name: name,
		imports: imports,
		superClass: superClass ? { superClassName: superClass } : null,
		constructorParams: constructorParams,
		attributes: attributes
	});
}

function renderEnum(pkg: string, name: string, values: string[]): string {
	return Mustache.render(enumTemplate, {
		pkg: pkg,
		name: name,
		values: values.join(', ')
	});
}

interface ClassAttribute {
	annotation?: Annotation;
	name: string;
	type: string;
}

interface Annotation {
	name: string;
}

interface Import {
	qualifiedName: string;
}
