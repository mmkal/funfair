/** https://pnpm.io/pnpmfile */
function readPackage(pkg) {
  if (pkg.name === 'eslint-plugin-functional') {
    delete pkg.peerDependencies.typescript
  }

  return pkg
}

module.exports = { hooks: { readPackage } }
