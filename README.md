# ICO

An expandable ICO implementation.

## Testing

For the testing purposes you need to install `truffle` and `testrpc` globally:
`npm install -g truffle ethereumjs-testrpc`.

**Tests won't work on `geth` because they use `evm_increaseTime` method which is specific to `tesrpc`!**

Then you need to install dependencies: `npm install`.

To run tests:

1. `testrpc`
1. In another terminal: `truffle test`

## Deployment

To deploy on the mainnet you need to run `geth` with the following parameters: `--rpc --rpcapi 'web3,eth,debug,net,personal' --rpcport 8545 --rpccorsdomain '*'`.

And then from the project directory: `truffle deploy`.