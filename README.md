An Ethereum smart contract implementing uni-directional payment channels. Currently deployed on the Rinkeby test network at <a href="https://rinkeby.etherscan.io/address/0x8994743c6631f2b4bfc9a97e17fb39a28b0502e1#code">0x8994743c6631F2b4bfC9a97e17fb39A28b0502e1</a>. The contract can be used via a module running on the Saito blockchain that passes payment messages back and forth between Saito users (https://github.com/nward13/EthChannelsSaitoModule).  
  
For more on payment channels see this <a href="https://blog.altcoin.io/payment-channels-explained-what-they-are-why-theyre-important-82d5046f073c" target="_blank">Medium post</a>.
  
## Usage  
  
Make sure truffle is installed globally.  
```npm install -g truffle```  

### To deploy the contracts locally
```git clone https://github.com/nward13/PaymentChannels.git```  
```cd PaymentChannels```  
```npm install```  
```truffle develop```  
```migrate --compile-all --reset```  
  
Contracts will be deployed to the default truffle develop instance on port 9545.

### To run tests or see gas usage of main channels contract  
```git clone https://github.com/nward13/saitoPaymentChannels.git```  
```cd saitoPaymentChannels```  
```npm install```  
```truffle test```  
  
### To see comparisons of some previously implemented gas optimizations  
```git clone -b gas-comparison https://github.com/nward13/PaymentChannels.git```  
```cd saitoPaymentChannels```  
```npm install```  
```truffle test```




