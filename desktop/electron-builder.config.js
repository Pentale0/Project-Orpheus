const includeMedia = process.env.ORPHEUS_INCLUDE_MEDIA === '1';
const outDir = process.env.ORPHEUS_OUT || 'dist';

module.exports = {
  appId: 'com.pentale0.orpheus',
  productName: 'Orpheus Player',
  directories: { output: outDir },
  files: ['main.js', 'preload.js', 'package.json'],
  extraResources: [
    {
      from: '../shared',
      to: 'shared',
      filter: includeMedia ? ['**/*'] : ['**/*', '!**/*.mp3'],
    },
  ],
  win: {
    target: ['nsis'],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    artifactName: 'Orpheus-Player-Setup-${version}.exe',
  },
};
