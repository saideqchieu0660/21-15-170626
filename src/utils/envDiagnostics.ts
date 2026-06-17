export function getEnvDiagnostics() {
  const envVars = import.meta.env;
  const diagnostics = Object.keys(envVars).reduce((acc, key) => {
    if (key.startsWith('VITE_')) {
      const value = envVars[key] as string | undefined;
      // Truncate sensitive values for safety
      let preview = 'N/A';
      if (value) {
        if (value.length > 10) {
          preview = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
        } else {
          preview = value;
        }
      }
      
      acc[key] = {
        exists: !!value,
        length: value?.length || 0,
        preview
      };
    }
    return acc;
  }, {} as Record<string, { exists: boolean, length: number, preview: string }>);
  
  return diagnostics;
}
