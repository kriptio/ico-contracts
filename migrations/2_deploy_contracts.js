let Token = artifacts.require('./IcoToken.sol');
let Ico = artifacts.require('./IcoSkeleton.sol');

const totalSupply = 1e10;
const tokenName = 'MyAwesomeToken';
const tokenSymbol = 'MAT';
const tokenDecimals = 2;

const emergencyAccount = "0x86b147c53ba96636de9a6c8317f7bffd4d05d393";
const tokenBasePrice = 10;
const tokensForSale = 1e9;
const minCap = 1e18;
const icoDuration = 1000;
const startsAt = 1503647359;
const endsAt = 1504647359;

module.exports = function(deployer) {
    deployer.deploy(Token, totalSupply, tokenName, tokenSymbol, tokenDecimals).then(() => {
        deployer.deploy(Ico,
            Token.address,
            emergencyAccount,
            tokenBasePrice,
            tokensForSale,
            minCap,
            startsAt,
            endsAt
        );
    });
};