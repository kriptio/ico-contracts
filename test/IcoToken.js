let expectThrow = require('./helpers/expectThrow.js');
let IcoToken = artifacts.require('./IcoToken.sol');

contract('IcoToken', accounts => {
    const totalSupply = 1000;
    const tokenName = 'MyAwesomeToken';
    const tokenSymbol = 'MAT';
    const tokenDecimals = 2;

    let token;

    beforeEach(async () => {
        token = await IcoToken.new(totalSupply,
                                   tokenName,
                                   tokenSymbol,
                                   tokenDecimals,
                                   { from: accounts[0] });
    });

    it('correct initialization', async () => {
        assert.equal(totalSupply, await token.totalSupply.call());
        assert.equal(tokenName, await token.name.call());
        assert.equal(tokenSymbol, await token.symbol.call());
        assert.equal(tokenDecimals, await token.decimals.call());
        assert.equal(totalSupply, await token.balanceOf.call(accounts[0]));
        assert.isOk(await token.locked.call());
    });

    it('only owner can unlock', async () => {
        await expectThrow(token.unlock({ from: accounts[1] }));
        await token.unlock({ from: accounts[0] });
    });

    it('only owner can lock', async () => {
        await token.unlock({ from: accounts[0] });
        await expectThrow(token.lock({ from: accounts[1] }));
        await token.lock({ from: accounts[0] });
    });

    it('only owner can transfer when the token is locked', async () => {
        await token.transfer(accounts[1], 2, { from: accounts[0] });
        await expectThrow(token.transfer(accounts[0], 1, { from: accounts[1] }));
        await token.approve(accounts[1], 1, { from: accounts[0] });
        await expectThrow(token.transferFrom(accounts[0], accounts[1], 1, { from: accounts[1] }));
        await token.approve(accounts[0], 1, { from: accounts[1] });
        await token.transferFrom(accounts[1], accounts[0], 1, { from: accounts[0] });
    });

    it('anyone can transfer when the token is unlocked', async () => {
        await token.unlock({ from: accounts[0] });
        await token.transfer(accounts[1], 2, { from: accounts[0] });
        await token.transfer(accounts[0], 1, { from: accounts[1] });
        await token.approve(accounts[1], 1, { from: accounts[0] });
        await token.transferFrom(accounts[0], accounts[1], 1, { from: accounts[1] });
        await token.approve(accounts[0], 1, { from: accounts[1] });
        await token.transferFrom(accounts[1], accounts[0], 1, { from: accounts[0] });
    });

    it('only owner can burn tokens', async () => {
        const toBurn = 100;

        await expectThrow(token.burn(toBurn, { from: accounts[1] }));
        await token.burn(toBurn, { from: accounts[0] });
        assert.equal(totalSupply - toBurn, await token.balanceOf.call(accounts[0]));
        assert.equal(totalSupply - toBurn, await token.totalSupply.call());
    });
});