import { FolderCopy } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function FsModule() {
  return (
    <ModuleDoc
      id="mod-fs"
      icon={<FolderCopy fontSize="small" />}
      title="fs"
      description="File system operations for reading and writing files."
      params={[
        { name: 'op', type: '"read" | "write"', required: true, description: 'Operation type' },
        { name: 'path', type: 'string', required: true, description: 'File path' },
        { name: 'content', type: 'string', description: 'Content to write (required for write)' }
      ]}
      returns='Read: file content as string. Write: { "success": true }'
      example={`// Read file
{
  "module": "fs",
  "params": { "op": "read", "path": "./config.json" }
}

// Write file
{
  "module": "fs",
  "params": { "op": "write", "path": "./output.txt", "content": "Hello!" }
}`}
    />
  );
}
