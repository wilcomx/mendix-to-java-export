import { JavaScriptSerializer } from "mendixmodelsdk";
import { MendixPlatformClient } from "mendixplatformsdk";
import * as fs from 'fs';

const exportConfig = JSON.parse(fs.readFileSync('export-config.json', 'utf8'));

const moduleName = "CASCentral";

async function main() {
    const client = new MendixPlatformClient();

    const app = client.getApp(exportConfig.appId);

    const workingCopy = await app.getOnlineWorkingCopy(exportConfig.workingCopyId);
    const model = await workingCopy.openModel();

    const domainModelInterface = model.allDomainModels().filter(dm => dm.containerAsModule.name === moduleName)[0];
    const domainModel = await domainModelInterface.load();

    console.log(JavaScriptSerializer.serializeToJs(domainModel));
}

main().catch(console.error);