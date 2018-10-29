An Ethereum smart contract implementing un-directional payment channels.  
  
## Usage  
  
Make sure truffle is installed globally.  
```npm install -g truffle```  

### To deploy the contracts locally
```git clone https://github.com/nward13/saitoPaymentChannels.git```  
```cd saitoPaymentChannels```  
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
```git clone -b gas-comparison https://github.com/nward13/saitoPaymentChannels.git```  
```cd saitoPaymentChannels```  
```npm install```  
```truffle test```




