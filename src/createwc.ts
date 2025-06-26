import { MendixPlatformClient } from "mendixplatformsdk";
import * as fs from 'fs';

const exportConfig = JSON.parse(fs.readFileSync('export-config.json', 'utf8'));

async function main() {
	const client = new MendixPlatformClient();
	const app = client.getApp(exportConfig.appId);
	const workingCopy = await app.createTemporaryWorkingCopy(exportConfig.branch);

	exportConfig.workingCopyId = workingCopy.workingCopyId;
	fs.writeFileSync('export-config.json', JSON.stringify(exportConfig, null, 4));
}

main().catch(console.error);