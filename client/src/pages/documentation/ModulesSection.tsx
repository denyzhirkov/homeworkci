import { Typography, Divider } from "@mui/material";
import { SectionHeader } from "../../components/DocumentationComponents.tsx";
import { ShellModule } from "./modules/ShellModule.tsx";
import { HttpModule } from "./modules/HttpModule.tsx";
import { GitModule } from "./modules/GitModule.tsx";
import { CryptoModule } from "./modules/CryptoModule.tsx";
import { FsModule } from "./modules/FsModule.tsx";
import { DelayModule } from "./modules/DelayModule.tsx";
import { WaitModule } from "./modules/WaitModule.tsx";
import { NotifyModule } from "./modules/NotifyModule.tsx";
import { DockerModule } from "./modules/DockerModule.tsx";
import { DockerRemoteModule } from "./modules/DockerRemoteModule.tsx";
import { ArchiveModule } from "./modules/ArchiveModule.tsx";
import { SshModule } from "./modules/SshModule.tsx";
import { S3Module } from "./modules/S3Module.tsx";
import { JsonModule } from "./modules/JsonModule.tsx";
import { PipelineModule } from "./modules/PipelineModule.tsx";
import { QueueModule } from "./modules/QueueModule.tsx";

export function ModulesSection() {
  return (
    <>
      <SectionHeader id="modules" title="Modules" subtitle="Built-in functionality" />
      <Typography variant="body2" paragraph>
        Modules are TypeScript functions that perform specific actions. HomeworkCI includes 12 built-in modules.
        You can also create custom modules by adding <code>.ts</code> files to the <code>modules/</code> directory.
      </Typography>

      <ShellModule />
      <HttpModule />
      <GitModule />
      <CryptoModule />
      <FsModule />
      <DelayModule />
      <WaitModule />
      <NotifyModule />
      <DockerModule />
      <DockerRemoteModule />
      <ArchiveModule />
      <SshModule />
      <S3Module />
      <JsonModule />

      <Divider sx={{ my: 4 }} />

      <PipelineModule />
      <QueueModule />
    </>
  );
}
