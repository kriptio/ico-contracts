let expectThrow = require('./helpers/expectThrow.js');
let IcoToken = artifacts.require('./IcoToken.sol');
let IcoSkeleton = artifacts.require('./IcoSkeleton.sol');

contract('IcoSkeleton', accounts => {
    const totalSupply = 1000;
    const tokenName = 'MyAwesomeToken';
    const tokenSymbol = 'MAT';
    const tokenDecimals = 2;

    const emergencyAccount = accounts[2];
    const tokenBasePrice = 10;
    const tokensForSale = totalSupply - 1;
    const minCap = 900;
    const icoDuration = 1000;

    let token;
    let ico;
    let startsAt;
    let endsAt;

    function sendRequest(method, params = []) {
        return new Promise((resolve, reject) => {
            web3.currentProvider.sendAsync({
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: new Date().getTime()
            }, (error, result) => error ? reject(error) : resolve(result.result));
        });
    }

    async function getLastTimestamp() {
        let blockNumber = await sendRequest('eth_blockNumber');
        let block = await sendRequest('eth_getBlockByNumber', [blockNumber, false]);
        return parseInt(block.timestamp, 16);
    }

    async function setBlockTime(time) {
        let lastTime = await getLastTimestamp();
        let increment = time - lastTime;
        if (increment <= 0) throw 'setBlockTime error';
        await sendRequest('evm_increaseTime', [increment]);
    }

    beforeEach(async () => {
        token = await IcoToken.new(totalSupply,
                                   tokenName,
                                   tokenSymbol,
                                   tokenDecimals,
                                   { from: accounts[0] });
        startsAt = (await getLastTimestamp()) + 10;
        endsAt = startsAt + icoDuration;
        ico = await IcoSkeleton.new(token.address,
                                    emergencyAccount,
                                    tokenBasePrice,
                                    tokensForSale,
                                    minCap,
                                    startsAt,
                                    endsAt,
                                    { from: accounts[0] });
        
        await token.transfer(ico.address, totalSupply, { from: accounts[0] });
        await token.transferOwnership(ico.address, { from: accounts[0] });
    });

    it('correctly initialized', async () => {
        assert.equal(await ico.token.call(), token.address);
        assert.equal(await ico.benefeciary.call(), accounts[0]);
        assert.equal(await ico.emergencyAccount.call(), emergencyAccount);
        assert.equal(await ico.tokenBasePrice.call(), tokenBasePrice);
        assert.equal(await ico.tokensForSale.call(), tokensForSale);
        assert.equal(await ico.minCap.call(), minCap);
        assert.equal(await ico.startsAt.call(), startsAt);
        assert.equal(await ico.endsAt.call(), endsAt);
        await expectThrow(ico.start());
        await expectThrow(ico.finish());
        await expectThrow(ico.send(1, { from: accounts[0] }));
    });

    it('start the ICO', async () => {
        await setBlockTime(startsAt);
        await ico.start();
        assert.isOk(await token.locked.call());
    });

    it('start the ICO after finish time', async () => {
        await setBlockTime(endsAt + 1);
        await expectThrow(ico.start());
    });

    it('try to buy tokens if the ICO didn\'t start', async () => {
        await setBlockTime(startsAt);
        await expectThrow(ico.send(1, { from: accounts[0] }));
    });

    it('try to buy tokens after the finish time', async () => {
        await setBlockTime(startsAt);
        await ico.start();
        await setBlockTime(endsAt + 1);
        await expectThrow(ico.send(1, { from: accounts[0] }));
    });

    it('try to buy more than sale amount', async () => {
        await setBlockTime(startsAt);
        await ico.start();
        await expectThrow(ico.send((tokensForSale + 1) * tokenBasePrice, { from: accounts[0] }));
    });

    it('try to buy tokens when all of the conditions are satisfied', async () => {
        const amountToBuy = 50;
        await setBlockTime(startsAt);
        await ico.start();
        await ico.send(amountToBuy * tokenBasePrice, { from: accounts[0] });
        assert.equal(amountToBuy, await token.balanceOf.call(accounts[0]));
        assert.equal(amountToBuy, await ico.sold.call());
    });

    it('call finish before start', async () => {
        await setBlockTime(endsAt + 1);
        await expectThrow(ico.finish());
    });

    it('call finish before end time', async () => {
        await setBlockTime(startsAt);
        ico.start();
        await expectThrow(ico.finish());
    });

    it('call finish when the minimal cap is not reached', async () => {
        await setBlockTime(startsAt);
        await ico.start();
        await ico.send(minCap - 1, { from: accounts[0] });
        await setBlockTime(endsAt + 1);
        await ico.finish();
        await expectThrow(ico.withdraw({ from: accounts[0] }));
        await ico.refund({ from: accounts[0] });
    });

    it('call finish when the minimal cap is reached', async () => {
        await setBlockTime(startsAt);
        await ico.start();
        await ico.send(minCap, { from: accounts[0] });
        await setBlockTime(endsAt + 1);
        await ico.finish();
        await ico.withdraw({ from: accounts[0] });
        await expectThrow(ico.refund({ from: accounts[0] }));
        assert.isOk((await token.totalSupply.call()).equals(await ico.sold.call()));
        assert.isNotOk(await token.locked.call());
    });

    it('benefeciary can be only set by the owner', async () => {
        await expectThrow(ico.setBenefeciary(accounts[4], { from: accounts[1] }));
        await ico.setBenefeciary(accounts[4], { from: accounts[0] });
    });

    it('money is always withdrawn to the benefeciary, not the owner', async () => {
        await ico.setBenefeciary(accounts[4], { from: accounts[0] });
        await setBlockTime(startsAt);
        await ico.start();
        await ico.send(minCap, { from: accounts[0] });
        await setBlockTime(endsAt + 1);
        await ico.finish();
        await expectThrow(ico.withdraw({ from: accounts[0] }));
        await ico.withdraw({ from: accounts[4] })
    });

    it('only emergency account can abort the ico', async () => {
        await ico.setBenefeciary(accounts[4], { from: accounts[0] });
        await setBlockTime(startsAt);
        await ico.start();
        await ico.send(minCap, { from: accounts[0] });
        await expectThrow(ico.abort({ from: accounts[0] }));
        await expectThrow(ico.abort({ from: accounts[4] }));
        await ico.abort({ from: emergencyAccount });
        await expectThrow(ico.withdraw({ from: accounts[4] }));
        await ico.refund({ from: accounts[0] });
    });

    it('ico can be aborted even after it was successfully finished', async () => {
        await setBlockTime(startsAt);
        await ico.start();
        await ico.send(minCap, { from: accounts[0] });
        await setBlockTime(endsAt + 1);
        await ico.finish();
        await ico.abort({ from: emergencyAccount });
        await expectThrow(ico.withdraw({ from: accounts[4] }));
        await ico.refund({ from: accounts[0] });
    });
});