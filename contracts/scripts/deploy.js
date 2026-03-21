/**
 * deploy.js — deploys ActivityRegistry → ImpactScore → LoanManager
 * and wires them together.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network localhost
 *   npx hardhat run scripts/deploy.js --network mumbai
 */

const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "MATIC");

  // 1. ActivityRegistry
  const ActivityRegistry = await hre.ethers.getContractFactory("ActivityRegistry");
  const registry = await ActivityRegistry.deploy();
  await registry.waitForDeployment();
  console.log("ActivityRegistry →", await registry.getAddress());

  // 2. ImpactScore
  const ImpactScore = await hre.ethers.getContractFactory("ImpactScore");
  const impactScore = await ImpactScore.deploy();
  await impactScore.waitForDeployment();
  console.log("ImpactScore      →", await impactScore.getAddress());

  // 3. Link ImpactScore ← ActivityRegistry
  const tx1 = await impactScore.setActivityRegistry(await registry.getAddress());
  await tx1.wait();
  console.log("ImpactScore linked to ActivityRegistry");

  // 4. LoanManager
  const LoanManager = await hre.ethers.getContractFactory("LoanManager");
  const loanManager = await LoanManager.deploy(await impactScore.getAddress());
  await loanManager.waitForDeployment();
  console.log("LoanManager      →", await loanManager.getAddress());

  // 5. Save addresses to file (read by backend)
  const addresses = {
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    ActivityRegistry: await registry.getAddress(),
    ImpactScore:      await impactScore.getAddress(),
    LoanManager:      await loanManager.getAddress(),
  };

  const outPath = path.join(__dirname, "../deployed-addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nAddresses saved to", outPath);
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
