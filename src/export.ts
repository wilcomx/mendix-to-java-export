import { MendixPlatformClient } from "mendixplatformsdk";
import { microflows, webservices } from "mendixmodelsdk";
import * as fs from 'fs';
import { microflow as mfjava } from "./microflow/microflow";
import mf = require('./mf');
import {javautils as ju} from './java/utils';
import dm = require('./dm');
import mkdirp = require('mkdirp');
import * as ncp from 'ncp';
import * as rimraf  from 'rimraf';

const exportConfig = JSON.parse(fs.readFileSync('export-config.json', 'utf8'));
const exportDir = 'project-export/src/main/java';

async function main() {
	const client = new MendixPlatformClient();
	const app = client.getApp(exportConfig.appId);

	const workingCopy = await app.getOnlineWorkingCopy(exportConfig.workingCopyId);
	const model = await workingCopy.openModel();

	if (fs.existsSync(exportDir)) {
		rimraf.sync(exportDir);
	}

	mkdirp.sync(exportDir);

	console.log(`Stubbing core components ...`);
	mkdirp.sync(`${exportDir}/core`);
	ncp.ncp(`templates/core`, `${exportDir}/core`, error => { });

	mkdirp.sync(`${exportDir}/mxsystem/domain`);
	ncp.ncp(`templates/mxsystem/domain`, `${exportDir}/mxsystem/domain`, error => { });
	fs.mkdirSync
	mkdirp.sync(`${exportDir}/mxsystem/javaaction`);
	ncp.ncp(`templates/mxsystem/javaaction`, `${exportDir}/mxsystem/javaaction`, error => { });

	mkdirp.sync(`${exportDir}/mxsystem/enumeration`);
	ncp.ncp(`templates/mxsystem/enumeration`, `${exportDir}/mxsystem/enumeration`, error => { });

	console.log(`Exporting domain models ...`);
	model.allDomainModels().forEach(domainModel => {
		domainModel.entities.forEach(entity => {
			const packagePath = exportDir + '/' + ju.getPackageEntity(entity).replace('.', '/');
			mkdirp.sync(packagePath);
			fs.writeFileSync(`${packagePath}/${entity.name}.java`, dm.renderEntity(entity, model));
		});
		domainModel.associations.forEach(association => {
			const packagePath = exportDir + '/' + ju.getPackageAssociation(association).replace('.', '/');
			mkdirp.sync(packagePath);
			fs.writeFileSync(`${packagePath}/${association.name}.java`, dm.renderAssociation(association));
		});
	});

	console.log(`Exporting constants ...`);
	const constants = model.allConstants().filter(c => !c.excluded);
	for await (const constant of constants.map(c => c.load())) {}


	console.log(`Exporting enumerations ...`);
	const enums = model.allEnumerations().filter(e => !e.excluded);
	for await (const enumeration of enums.map(e => e.load())) {
		const packagePath = exportDir + '/' + ju.getPackageEnumeration(enumeration).replace('.', '/');
		mkdirp.sync(packagePath);
		fs.writeFileSync(`${packagePath}/${enumeration.name}.java`, dm.renderEnumeration(enumeration));
	}
	
	console.log(`Generating MXData interface ...`);
	fs.writeFileSync(`${exportDir}/core/MXData.java`, dm.renderMXData(model));

	console.log(`Exporting microflows ...`);
	const mfs = model.allMicroflows().filter(mf => !mf.excluded);
	
	for await (const microflow of mfs.map(mf => mf.load())) {
		console.log(`=== ${microflow.qualifiedName} ===`);

		const actions = microflow.objectCollection.objects;
		await loadMicroflowActivities(actions);

		const packagePath = exportDir + '/' + ju.getPackageMicroflow(microflow).replace('.', '/');
		mkdirp.sync(packagePath);
		//fs.writeFileSync(`${packagePath}/${microflow.name}.java`, mf.renderMicroflow(microflow, model));
		fs.writeFileSync(`${packagePath}/${microflow.name}.java`, mfjava.renderMicroflow(microflow, model));
	}

	console.log(`Exporting java actions ...`);
	const ja = model.allJavaActions().filter(ja => !ja.excluded)

	for await (const javaAction of ja.map(j => j.load())) {
		console.log(`=== ${javaAction.qualifiedName} ===`);
		const packagePath = exportDir + '/' + ju.getPackageJavaAction(javaAction).replace('.', '/');
		mkdirp.sync(packagePath);
		fs.writeFileSync(`${packagePath}/${javaAction.name}.java`, dm.renderJavaAction(javaAction));
	}

	console.log(`Exporting rules ...`);
	const rules = model.allRules().filter(r => !r.excluded);
	
	for await (const rule of rules.map(r => r.load())) {
		console.log(`=== ${rule.qualifiedName} ===`);
		const packagePath = exportDir + '/' + ju.getPackageMicroflow(rule).replace('.', '/');
		mkdirp.sync(packagePath);
		fs.writeFileSync(`${packagePath}/${rule.name}.java`, mf.renderRule(rule, model));
	}

	console.log(`Generating web services ...`);
	const webServices =	model.allImportedWebServices().filter(ws => !ws.excluded);
	for await (const webService of webServices.map(ws => ws.load())) {
		console.log(`=== ${webService.qualifiedName} ===`);
		const packagePath = exportDir + '/' + ju.getPackageImportedWebService(webService).replace('.', '/');
		mkdirp.sync(packagePath);
		fs.writeFileSync(`${packagePath}/${webService.name}.java`, dm.renderImportedWebService(webService));
	}

	console.log(`Generating app services ...`);
	const appServices = model.allConsumedAppServices().filter(as => !as.excluded);
	for await (const appService of appServices.map(as => as.load())) {
		console.log(`=== ${appService.qualifiedName} ===`);
		const packagePath = exportDir + '/' + ju.getPackageConsumedAppService(appService).replace('.', '/');
		mkdirp.sync(packagePath);
		fs.writeFileSync(`${packagePath}/${appService.name}.java`, dm.renderConsumedAppService(appService));
	}
}

async function loadMicroflowActivities(microflowObjects: microflows.MicroflowObject[]) {
	for await (const actionActivity of microflowObjects.map(j => j.load())) {
		if (actionActivity instanceof microflows.LoopedActivity) {
			await loadMicroflowActivities(actionActivity.objectCollection.objects);
		}
		if (actionActivity instanceof microflows.ActionActivity) {
			const action = actionActivity.action;
			if (action instanceof microflows.JavaActionCallAction) {
				await action.javaAction?.actionReturnType.load();
				await action.javaAction?.actionParameters.map(p => p.load());
			}
		}
	}
}

main().catch(console.error);