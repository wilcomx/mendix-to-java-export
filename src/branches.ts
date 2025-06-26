import { MendixPlatformClient } from "mendixplatformsdk";
import * as fs from 'fs';

const exportConfig = JSON.parse(fs.readFileSync('export-config.json', 'utf8'));

async function main() {
	const client = new MendixPlatformClient();
	const app = client.getApp(exportConfig.appId);
	const repository = app.getRepository();
	const branches = await repository.getBranches();
	console.log(`Branches found:`);
	branches.items.forEach(branch => {
		console.log('* ' + branch.name)
	});
}

main().catch(console.error);