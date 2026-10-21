// Metro: ship the 3D avatar (assets/avatar3d/avatar.glb) as a plain asset.
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('glb')) config.resolver.assetExts.push('glb');
module.exports = config;
