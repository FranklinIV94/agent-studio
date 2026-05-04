import xrpl from 'xrpl'

const XRPL_TESTNET = 'wss://s.altnet.rippletest.net:51233'

export interface WalletConnection {
  address: string
  publicKey: string
  balance: number
}

export async function connectWallet(seed: string): Promise<WalletConnection> {
  const client = new xrpl.Client(XRPL_TESTNET)
  await client.connect()
  
  const wallet = xrpl.Wallet.fromSeed(seed)
  const info = await client.request({
    command: 'account_info',
    account: wallet.address
  })
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const balance = (info.result as any).account_data?.Balance || '0'
  await client.disconnect()
  
  return {
    address: wallet.address,
    publicKey: wallet.publicKey,
    balance: parseInt(balance as string) / 1_000_000
  }
}

export async function sendUSDCOnTestnet(
  seed: string,
  toAddress: string,
  amount: number
): Promise<{ hash: string; fee: number }> {
  const client = new xrpl.Client(XRPL_TESTNET)
  await client.connect()
  
  const wallet = xrpl.Wallet.fromSeed(seed)
  
  const payment = {
    TransactionType: 'Payment',
    Account: wallet.address,
    Amount: xrpl.xrpToDrops(amount),
    Destination: toAddress,
    Memos: [{
      Memo: {
        MemoData: xrpl.convertStringToHex('Agent Studio Demo'),
        MemoFormat: xrpl.convertStringToHex('text/plain')
      }
    }]
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prepared = await client.autofill(payment as any)
  const signed = wallet.sign(prepared)
  await client.submitAndWait(signed.tx_blob)
  
  await client.disconnect()
  
  return {
    hash: signed.hash,
    fee: prepared.Fee ? parseInt(prepared.Fee) / 1_000_000 : 0
  }
}

export async function getAccountInfo(address: string): Promise<{
  balance: number
  txCount: number
}> {
  const client = new xrpl.Client(XRPL_TESTNET)
  await client.connect()
  
  const info = await client.request({
    command: 'account_info',
    account: address
  })
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const balance = (info.result as any).account_data?.Balance || '0'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const txCount = (info.result as any).account_data?.TransactionCount || 0
  
  await client.disconnect()
  
  return {
    balance: parseInt(balance as string) / 1_000_000,
    txCount
  }
}

export function getExplorerUrl(txHash: string): string {
  return `https://testnet.xrpl.org/transactions/${txHash}`
}
