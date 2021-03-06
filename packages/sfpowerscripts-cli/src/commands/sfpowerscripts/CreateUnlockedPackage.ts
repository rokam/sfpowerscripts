import PackageMetadata from "@dxatscale/sfpowerscripts.core/lib/PackageMetadata";
import ArtifactGenerator from "@dxatscale/sfpowerscripts.core/lib/generators/ArtifactGenerator";
import CreateUnlockedPackageImpl from '@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/CreateUnlockedPackageImpl';
import PackageDiffImpl from '@dxatscale/sfpowerscripts.core/lib/package/PackageDiffImpl';
import { flags } from '@salesforce/command';
import SfpowerscriptsCommand from '../../SfpowerscriptsCommand';
import { Messages } from '@salesforce/core';
import {isNullOrUndefined} from "util";
import {exec} from "shelljs";
const fs = require("fs-extra");


// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages(
  "@dxatscale/sfpowerscripts",
  "create_unlocked_package"
);

export default class CreateUnlockedPackage extends SfpowerscriptsCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
    `$ sfdx sfpowerscripts:CreateUnlockedPackage -n <packagealias> -b -x -v <devhubalias> --refname <name>`,
    `$ sfdx sfpowerscripts:CreateUnlockedPackage -n <packagealias> -b -x -v <devhubalias> --diffcheck --gittag\n`,
    `Output variable:`,
    `sfpowerscripts_package_version_id`,
    `<refname>_sfpowerscripts_package_version_id`,
    `sfpowerscripts_artifact_metadata_directory`,
    `<refname>_sfpowerscripts_artifact_metadata_directory`,
    `sfpowerscripts_artifact_directory`,
    `<refname>_sfpowerscripts_artifact_directory`,
    `sfpowerscripts_package_version_number`,
    `<refname>_sfpowerscripts_package_version_number`
  ];

  protected static requiresUsername = false;
  protected static requiresDevhubUsername = false;

  protected static flagsConfig = {
    package: flags.string({required: true, char: 'n' , description: messages.getMessage('packageFlagDescription')}),
    buildartifactenabled: flags.boolean({char: 'b', description: messages.getMessage('buildArtifactEnabledFlagDescription'), default: true}),
    installationkey: flags.string({char: 'k', description: messages.getMessage('installationKeyFlagDescription'), exclusive: ['installationkeybypass']}),
    installationkeybypass: flags.boolean({char: 'x', description: messages.getMessage('installationKeyBypassFlagDescription'), exclusive: ['installationkey']}),
    devhubalias: flags.string({char: 'v', description: messages.getMessage('devhubAliasFlagDescription'), default: 'HubOrg'}),
    diffcheck: flags.boolean({description: messages.getMessage('diffCheckFlagDescription')}),
    gittag: flags.boolean({description: messages.getMessage('gitTagFlagDescription')}),
    repourl: flags.string({char: 'r', description: messages.getMessage('repoUrlFlagDescription')}),
    versionnumber: flags.string({description: messages.getMessage('versionNumberFlagDescription')}),
    configfilepath: flags.filepath({char: 'f', description: messages.getMessage('configFilePathFlagDescription'), default: 'config/project-scratch-def.json'}),
    artifactdir: flags.directory({description: messages.getMessage('artifactDirectoryFlagDescription'), default: 'artifacts'}),
    enablecoverage: flags.boolean({description: messages.getMessage('enableCoverageFlagDescription')}),
    isvalidationtobeskipped: flags.boolean({char: 's', description: messages.getMessage('isValidationToBeSkippedFlagDescription')}),
    tag: flags.string({description: messages.getMessage('tagFlagDescription')}),
    waittime: flags.string({description: messages.getMessage('waitTimeFlagDescription'), default: '120'}),
    refname: flags.string({description: messages.getMessage('refNameFlagDescription')})
  };


  public async execute(){
    try {

      const sfdx_package: string = this.flags.package;
      const version_number: string = this.flags.versionnumber;
      const artifactDirectory: string = this.flags.artifactdir;
      const refname: string = this.flags.refname;

      let tag: string = this.flags.tag;
      let config_file_path = this.flags.configfilepath;
      let installationkeybypass = this.flags.installationkeybypass;
      let isCoverageEnabled: boolean = this.flags.enablecoverage;
      let isSkipValidation: boolean = this.flags.isvalidationtobeskipped;
      let installationkey = this.flags.installationkey;
      let devhub_alias = this.flags.devhubalias;
      let wait_time = this.flags.waittime;


      let runBuild: boolean;
      if (this.flags.diffcheck) {
        let packageDiffImpl = new PackageDiffImpl(
          sfdx_package,
          null,
          config_file_path
        );

        runBuild = await packageDiffImpl.exec();

        if (runBuild)
          console.log(
            `Detected changes to ${sfdx_package} package...proceeding\n`
          );
        else
          console.log(
            `No changes detected for ${sfdx_package} package...skipping\n`
          );
      } else runBuild = true;

      if (runBuild) {
        let repository_url: string;
        if (isNullOrUndefined(this.flags.repourl)) {
          repository_url = exec("git config --get remote.origin.url", {
            silent: true,
          });
          // Remove new line '\n' from end of url
          repository_url = repository_url.slice(0, repository_url.length - 1);
        } else repository_url = this.flags.repourl;

        let commit_id = exec("git log --pretty=format:%H -n 1", {
          silent: true,
        });

        let packageMetadata: PackageMetadata = {
          package_name: sfdx_package,
          package_type: "unlocked",
          package_version_number: version_number,
          sourceVersion: commit_id,
          repository_url: repository_url,
          tag: tag,
        };

        let createUnlockedPackageImpl: CreateUnlockedPackageImpl = new CreateUnlockedPackageImpl(
          sfdx_package,
          version_number,
          config_file_path,
          installationkeybypass,
          installationkey,
          null,
          devhub_alias,
          wait_time,
          isCoverageEnabled,
          isSkipValidation,
          packageMetadata
        );

        let result = await createUnlockedPackageImpl.exec();

        if (this.flags.gittag) {
          exec(`git config --global user.email "sfpowerscripts@dxscale"`);
          exec(`git config --global user.name "sfpowerscripts"`);

          let tagname = `${sfdx_package}_v${result.package_version_number}`;
          console.log(`Creating tag ${tagname}`);
          exec(
            `git tag -a -m "${sfdx_package} Unlocked Package ${result.package_version_number}" ${tagname} HEAD`,
            { silent: false }
          );
        }


        console.log(JSON.stringify(packageMetadata, function(key, val) {
          if (key !== "payload")
              return val;
         }));

        //Generate Artifact
        let artifact = await ArtifactGenerator.generateArtifact(sfdx_package,process.cwd(),artifactDirectory,packageMetadata);

          console.log("\nOutput variables:");
          if (!isNullOrUndefined(refname)) {
            fs.writeFileSync('.env', `${refname}_sfpowerscripts_package_version_id=${packageMetadata.package_version_id}\n`, {flag:'a'});
            console.log(`${refname}_sfpowerscripts_package_version_id=${packageMetadata.package_version_id}`);
            fs.writeFileSync('.env', `${refname}_sfpowerscripts_artifact_directory=${artifact.artifactDirectory}\n`, {flag:'a'});
            console.log(`${refname}_sfpowerscripts_artifact_directory=${artifact.artifactDirectory}`);
            fs.writeFileSync('.env', `${refname}_sfpowerscripts_package_version_number=${packageMetadata.package_version_number}\n`, {flag:'a'});
            console.log(`${refname}_sfpowerscripts_package_version_number=${packageMetadata.package_version_number}`);
          } else {
            fs.writeFileSync('.env', `sfpowerscripts_package_version_id=${packageMetadata.package_version_id}\n`, {flag:'a'});
            console.log(`sfpowerscripts_package_version_id=${packageMetadata.package_version_id}`);
            fs.writeFileSync('.env', `sfpowerscripts_artifact_directory=${artifact.artifactDirectory}\n`, {flag:'a'});
            console.log(`sfpowerscripts_artifact_directory=${artifact.artifactDirectory}`);
            fs.writeFileSync('.env', `sfpowerscripts_package_version_number=${packageMetadata.package_version_number}\n`, {flag:'a'});
            console.log(`sfpowerscripts_package_version_number=${packageMetadata.package_version_number}`);
          }

      }
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
  }
}
