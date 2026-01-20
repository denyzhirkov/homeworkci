import { Archive } from "@mui/icons-material";
import { ModuleDoc } from "../../../components/DocumentationComponents.tsx";

export function ArchiveModule() {
  return (
    <ModuleDoc
      id="mod-archive"
      icon={<Archive fontSize="small" />}
      title="archive"
      description="Creates and extracts ZIP archives. Useful for packaging build artifacts."
      params={[
        { name: 'op', type: '"zip" | "unzip"', required: true, description: 'Operation type' },
        { name: 'source', type: 'string', required: true, description: 'Source file or directory' },
        { name: 'output', type: 'string', required: true, description: 'Output path' }
      ]}
      returns='{ "success": true, "files": 42 }'
      example={`// Create archive
{
  "module": "archive",
  "params": {
    "op": "zip",
    "source": "./dist",
    "output": "./artifacts/build.zip"
  }
}

// Extract archive
{
  "module": "archive",
  "params": {
    "op": "unzip",
    "source": "./build.zip",
    "output": "./extracted"
  }
}`}
    />
  );
}
