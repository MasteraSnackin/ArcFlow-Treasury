/**
 * Setup Verification Script
 *
 * Verifies that the ArcFlow Treasury project is properly configured
 * and ready for deployment.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ArcFlow Treasury Setup Verification\n');

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

// Check 1: Root dependencies
console.log('📦 Checking root dependencies...');
const rootPackageJson = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(rootPackageJson)) {
  const nodeModules = path.join(__dirname, '..', 'node_modules');
  if (fs.existsSync(nodeModules)) {
    checks.passed.push('Root dependencies installed');
  } else {
    checks.failed.push('Root node_modules not found. Run: npm install');
  }
} else {
  checks.failed.push('Root package.json not found');
}

// Check 2: Backend dependencies
console.log('📦 Checking backend dependencies...');
const backendPackageJson = path.join(__dirname, '..', 'arcflow-backend', 'package.json');
if (fs.existsSync(backendPackageJson)) {
  const backendNodeModules = path.join(__dirname, '..', 'arcflow-backend', 'node_modules');
  if (fs.existsSync(backendNodeModules)) {
    checks.passed.push('Backend dependencies installed');
  } else {
    checks.failed.push('Backend node_modules not found. Run: cd arcflow-backend && npm install');
  }
} else {
  checks.failed.push('Backend package.json not found');
}

// Check 3: Root .env
console.log('⚙️  Checking environment configuration...');
const rootEnv = path.join(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) {
  const envContent = fs.readFileSync(rootEnv, 'utf8');

  // Check for required variables
  if (envContent.includes('ARC_TESTNET_RPC_URL=') && !envContent.includes('ARC_TESTNET_RPC_URL=https://your-arc-testnet-rpc')) {
    checks.passed.push('Root .env configured with RPC URL');
  } else {
    checks.warnings.push('Root .env exists but ARC_TESTNET_RPC_URL needs to be set');
  }

  if (envContent.includes('ARC_PRIVATE_KEY=0x') && envContent.match(/ARC_PRIVATE_KEY=0x[0-9a-fA-F]{64}/)) {
    checks.passed.push('Root .env configured with private key');
  } else if (envContent.includes('ARC_PRIVATE_KEY=0xYOUR_PRIVATE_KEY')) {
    checks.warnings.push('Root .env exists but ARC_PRIVATE_KEY needs to be set');
  } else {
    checks.warnings.push('Root .env exists but ARC_PRIVATE_KEY may be invalid');
  }
} else {
  checks.failed.push('Root .env not found. Copy from .env.example or create one');
}

// Check 4: Backend .env
const backendEnv = path.join(__dirname, '..', 'arcflow-backend', '.env');
if (fs.existsSync(backendEnv)) {
  const backendEnvContent = fs.readFileSync(backendEnv, 'utf8');

  if (backendEnvContent.includes('ARC_TESTNET_RPC_URL=') && !backendEnvContent.includes('ARC_TESTNET_RPC_URL=https://your-arc-testnet-rpc')) {
    checks.passed.push('Backend .env configured with RPC URL');
  } else {
    checks.warnings.push('Backend .env exists but ARC_TESTNET_RPC_URL needs to be set');
  }

  if (backendEnvContent.includes('ARC_PAYOUT_ROUTER_ADDRESS=0x')) {
    if (backendEnvContent.includes('ARC_PAYOUT_ROUTER_ADDRESS=0xYourDeployedPayoutRouterAddress')) {
      checks.warnings.push('Backend .env exists but ARC_PAYOUT_ROUTER_ADDRESS needs deployment address');
    } else {
      checks.passed.push('Backend .env configured with router address');
    }
  } else {
    checks.warnings.push('Backend .env exists but ARC_PAYOUT_ROUTER_ADDRESS needs to be set');
  }
} else {
  checks.warnings.push('Backend .env not found. Copy from arcflow-backend/.env.example (can be done after deployment)');
}

// Check 5: Compiled contracts
console.log('🔨 Checking contract compilation...');
const artifacts = path.join(__dirname, '..', 'artifacts');
const typechain = path.join(__dirname, '..', 'typechain-types');
if (fs.existsSync(artifacts) && fs.existsSync(typechain)) {
  checks.passed.push('Contracts compiled');
} else {
  checks.warnings.push('Contracts not compiled yet. Run: npm run compile');
}

// Check 6: Contract files
console.log('📄 Checking contract files...');
const requiredContracts = [
  'contracts/ArcFlowEscrow.sol',
  'contracts/ArcFlowStreams.sol',
  'contracts/ArcFlowPayoutRouter.sol'
];

requiredContracts.forEach(contract => {
  const contractPath = path.join(__dirname, '..', contract);
  if (fs.existsSync(contractPath)) {
    checks.passed.push(`${contract} found`);
  } else {
    checks.failed.push(`${contract} not found`);
  }
});

// Check 7: Backend files
console.log('📄 Checking backend files...');
const requiredBackendFiles = [
  'arcflow-backend/src/config/arc.ts',
  'arcflow-backend/src/services/circleClient.ts',
  'arcflow-backend/src/workers/payoutWorker.ts',
  'arcflow-backend/src/server.ts'
];

requiredBackendFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    checks.passed.push(`${file} found`);
  } else {
    checks.failed.push(`${file} not found`);
  }
});

// Check 8: Test files
console.log('🧪 Checking test files...');
const testDir = path.join(__dirname, '..', 'test');
if (fs.existsSync(testDir)) {
  const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts'));
  if (testFiles.length >= 3) {
    checks.passed.push(`${testFiles.length} contract test files found`);
  } else {
    checks.warnings.push(`Only ${testFiles.length} test files found, expected 3+`);
  }
} else {
  checks.failed.push('Test directory not found');
}

// Print results
console.log('\n' + '='.repeat(60));
console.log('📊 Verification Results\n');

if (checks.passed.length > 0) {
  console.log('✅ Passed (' + checks.passed.length + ')');
  checks.passed.forEach(check => console.log('  ✓ ' + check));
  console.log('');
}

if (checks.warnings.length > 0) {
  console.log('⚠️  Warnings (' + checks.warnings.length + ')');
  checks.warnings.forEach(check => console.log('  ⚠ ' + check));
  console.log('');
}

if (checks.failed.length > 0) {
  console.log('❌ Failed (' + checks.failed.length + ')');
  checks.failed.forEach(check => console.log('  ✗ ' + check));
  console.log('');
}

console.log('='.repeat(60));

// Final status
if (checks.failed.length === 0) {
  if (checks.warnings.length === 0) {
    console.log('\n🎉 All checks passed! Your setup is complete.');
    console.log('\n📝 Next steps:');
    console.log('  1. Run: npm test (verify all tests pass)');
    console.log('  2. Run: npm run deploy:arc (deploy to Arc testnet)');
    console.log('  3. Configure backend .env with deployed addresses');
    console.log('  4. Run: cd arcflow-backend && npm run dev:server');
  } else {
    console.log('\n✅ Setup is mostly complete with some warnings.');
    console.log('   Review warnings above before proceeding.');
  }
  process.exit(0);
} else {
  console.log('\n❌ Setup incomplete. Please address failed checks above.');
  process.exit(1);
}
