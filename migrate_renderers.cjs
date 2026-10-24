const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src/modules/modelhub/components/capability-renderers/base');
const destDir = path.join(__dirname, 'src/modules/modelhub/components/capability-fields');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
const registryEntries = [];

files.forEach(file => {
  if (!file.endsWith('.tsx')) return;

  const newFileName = file.replace('Renderer', '');
  const componentName = newFileName.replace('.tsx', '');
  const oldComponentName = file.replace('.tsx', '');
  
  let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  
  // Extract match logic
  const matchRegex = /match:\s*\((.*?)\)\s*=>\s*(.*?),/;
  const matchResult = content.match(matchRegex);
  let matchLogic = matchResult ? `(props) => ${matchResult[2]}` : null;
  if (!matchLogic) {
      const typeMatch = content.match(/props\.field\.type === "(.*?)"/);
      if (typeMatch) {
          matchLogic = `(props) => (props.field.type === "${typeMatch[1]}" ? 10 : 0)`;
      }
  }

  registryEntries.push({ componentName, matchLogic });

  // Replace component name
  content = content.replace(new RegExp(oldComponentName, 'g'), componentName);

  // Remove registry import and registration
  content = content.replace(/import \{.*?capabilityFieldRegistry.*?\} from ".*?";\n?/g, (match) => {
      if (match.includes('CapabilityFieldRendererProps')) {
          return 'import { CapabilityFieldRendererProps } from "@/modules/modelhub/components/ModelCapabilityFieldRegistry";\n';
      }
      return '';
  });
  content = content.replace(/capabilityFieldRegistry\.register\(\{[\s\S]*?\}\);?/g, '');

  fs.writeFileSync(path.join(destDir, newFileName), content);
});

// Generate index.ts
let indexContent = `import { capabilityFieldRegistry } from "../ModelCapabilityFieldRegistry";\n`;
registryEntries.forEach(entry => {
  indexContent += `import { ${entry.componentName} } from "./${entry.componentName}";\n`;
});

indexContent += `\nexport function registerBaseCapabilityFields() {\n`;
registryEntries.forEach(entry => {
  indexContent += `  capabilityFieldRegistry.register({\n    match: ${entry.matchLogic},\n    component: ${entry.componentName},\n  });\n`;
});
indexContent += `}\n\n`;
indexContent += `export * from "../ModelCapabilityFieldRegistry";\n`;

fs.writeFileSync(path.join(destDir, 'index.ts'), indexContent);

// Update ModelHubModelEditorPage.tsx
const pagePath = path.join(__dirname, 'src/modules/modelhub/components/ModelHubModelEditorPage.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');
pageContent = pageContent.replace(/capability-renderers/g, 'capability-fields');
fs.writeFileSync(pagePath, pageContent);

console.log('Migration completed successfully.');