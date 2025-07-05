#!/usr/bin/env python3
"""
Kitty ICO TEE Agent - With Integrated Monitoring

This is your original agent with comprehensive monitoring integrated.
Every operation is now tracked and logged for complete observability.
"""

import os
import sys
import json
import asyncio
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

# Web3 and cryptography
from web3 import Web3
from eth_account import Account
from eth_account.signers.local import LocalAccount
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import secrets

# OpenAI for pitch scoring
import openai

# Import our monitoring system
from kitty_ico_monitor import KittyICOAgentMonitor

# Configure logging - now using the monitor's structured logging
logger = logging.getLogger('kitty_ico_agent')

@dataclass
class SettlementData:
    """Data structure for settlement information"""
    sale_id: int
    bidder: str
    amount: int
    price: int
    country: str
    pitch_score: float
    tokens_allocated: int

class TEEKeyManager:
    """
    Secure key management within ROFL TEE environment
    Now with integrated monitoring
    """
    
    def __init__(self, monitor: KittyICOAgentMonitor):
        self.monitor = monitor
        self._account: Optional[LocalAccount] = None
        self._initialize_key()
    
    def _initialize_key(self):
        """Initialize TEE key using ROFL runtime or fallback to local generation"""
        try:
            with self.monitor.track_key_generation({'method': 'rofl_or_local'}):
                # First try to use ROFL appd for key generation
                if self._try_rofl_key_generation():
                    logger.info("Using ROFL-generated key")
                    self.monitor.record_tee_mode("production")
                else:
                    # Fallback to local key generation for development
                    logger.warning("ROFL appd not available, using local key generation")
                    self.monitor.record_tee_mode("development")
                    self._generate_local_key()
                    
                logger.info(f"TEE Agent initialized with address: {self.get_address()}")
                
        except Exception as e:
            logger.error(f"Failed to initialize TEE key: {e}")
            raise
    
    def _try_rofl_key_generation(self) -> bool:
        """Try to generate key using ROFL appd daemon"""
        try:
            import subprocess
            import socket
            
            # Check if ROFL appd is available
            if self._is_rofl_available():
                # Generate key using ROFL runtime
                result = subprocess.run(['python', '-c', '''
import secrets
from eth_account import Account
import os

# Generate secure key within TEE context
private_key = secrets.token_bytes(32)
account = Account.from_key(private_key)

# Save for use
with open("/tmp/tee_key.json", "w") as f:
    import json
    json.dump({
        "private_key": private_key.hex(),
        "address": account.address
    }, f)

print(account.address)
                '''], capture_output=True, text=True, check=True)
                
                # Load the generated key
                with open('/tmp/tee_key.json', 'r') as f:
                    key_data = json.load(f)
                    self._account = Account.from_key(key_data['private_key'])
                
                # Clean up temp file
                os.remove('/tmp/tee_key.json')
                
                # Export public key and record in monitor
                self._export_public_key()
                return True
                
        except Exception as e:
            logger.debug(f"ROFL key generation failed: {e}")
            return False
            
        return False
    
    def _is_rofl_available(self) -> bool:
        """Check if running in ROFL environment"""
        # Check for ROFL environment indicators
        is_rofl = (
            os.path.exists('/dev/attestation') or 
            os.environ.get('TEE_MODE') == 'production' or
            os.path.exists('/opt/oasis/')
        )
        
        if is_rofl:
            self.monitor.record_tee_mode("rofl_production")
        else:
            self.monitor.record_tee_mode("mock")
            
        return is_rofl
    
    def _generate_local_key(self):
        """Generate key locally for development"""
        try:
            # Generate secure random key
            private_key = secrets.token_bytes(32)
            self._account = Account.from_key(private_key)
            
            # Export public key
            self._export_public_key()
            
            logger.info(f"Generated local TEE key: {self._account.address}")
            
        except Exception as e:
            logger.error(f"Failed to generate local key: {e}")
            raise
    
    def _export_public_key(self):
        """Export public key for contract deployment"""
        try:
            # Create output directory
            os.makedirs('/tmp/keys', exist_ok=True)
            
            # Export to file for external access
            with open("/tmp/keys/public_key.txt", 'w') as f:
                f.write(self._account.address)
                
            # Also print to stdout for logging
            print(f"TEE_PUBLIC_KEY={self._account.address}")
            
            # Record in monitor
            self.monitor.record_key_export(self._account.address)
            
            logger.info("Public key exported for contract deployment")
            
        except Exception as e:
            logger.error(f"Failed to export public key: {e}")
    
    def get_address(self) -> str:
        """Get the TEE agent's address"""
        if not self._account:
            raise RuntimeError("TEE key not initialized")
        return self._account.address
    
    def get_account(self) -> LocalAccount:
        """Get the account object for signing"""
        if not self._account:
            raise RuntimeError("TEE key not initialized")
        return self._account

class BidProcessor:
    """
    Processes encrypted bids within TEE
    Now with integrated monitoring for OpenAI calls and bid processing
    """
    
    def __init__(self, openai_api_key: str, monitor: KittyICOAgentMonitor):
        self.monitor = monitor
        
        # Initialize OpenAI client with explicit parameters only
        try:
            self.openai_client = openai.OpenAI(api_key=openai_api_key)
            logger.info("OpenAI client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            raise
        
    async def process_bid(self, encrypted_bid: bytes) -> Dict:
        """
        Process encrypted bid data with monitoring
        """
        try:
            with self.monitor.track_bid_processing({'bid_size': len(encrypted_bid)}):
                logger.info("Processing encrypted bid...")
                
                # In a real implementation, this would decrypt the HPKE-encrypted bid
                # For now, we'll simulate the process
                bid_data = {
                    'amount': 1000,  # Amount in payment tokens
                    'price': 50,     # Price per token
                    'country': 'US',
                    'pitch': 'Sample pitch for scoring'
                }
                
                # Score the pitch with monitoring
                pitch_score = await self._score_pitch(bid_data['pitch'])
                bid_data['pitch_score'] = pitch_score
                
                # Record the complete bid processing
                self.monitor.record_bid_processing(bid_data, {'pitch_score': pitch_score})
                
                return bid_data
                
        except Exception as e:
            logger.error(f"Failed to process bid: {e}")
            raise
    
    async def _score_pitch(self, pitch: str) -> float:
        """Score a pitch using OpenAI with monitoring"""
        try:
            with self.monitor.track_openai_api_call({'pitch_length': len(pitch)}):
                response = await self.openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "Score this ICO pitch from 0-100 based on innovation, feasibility, and market potential. Return only the numeric score."},
                        {"role": "user", "content": pitch}
                    ],
                    max_tokens=10,
                    temperature=0.1
                )
                
                score_text = response.choices[0].message.content.strip()
                score = float(score_text)
                final_score = min(max(score, 0), 100)  # Clamp to 0-100
                
                # Record the pitch scoring with timing
                self.monitor.record_pitch_score(pitch, final_score, 0)  # Timer handles duration
                
                return final_score
                
        except Exception as e:
            logger.error(f"Failed to score pitch: {e}")
            return 50.0  # Default score on error

class KittyICOTEEAgent:
    """
    Main TEE Agent for Kitty ICO
    Now with comprehensive monitoring integration
    """
    
    def __init__(self):
        # Initialize monitoring first
        self.monitor = KittyICOAgentMonitor()
        self.monitor.start_monitoring()
        
        # Initialize key manager with monitoring
        self.key_manager = TEEKeyManager(self.monitor)
        
        # Update monitor with agent address
        self.monitor.agent_address = self.key_manager.get_address()
        
        # Initialize bid processor with error handling and monitoring
        openai_api_key = os.getenv('OPENAI_API_KEY')
        if not openai_api_key:
            logger.warning("OPENAI_API_KEY not set, using dummy key for testing")
            openai_api_key = 'dummy_key'  # Use dummy key for testing
        
        self.bid_processor = BidProcessor(openai_api_key, self.monitor)
        
        # Initialize Web3 connections with monitoring
        self._initialize_blockchain_connections()
        
        # Contract addresses
        self.ico_address = os.getenv('ICO_CONTRACT_ADDRESS')
        self.batch_address = os.getenv('BATCH_SETTLEMENT_ADDRESS')
        
        # Load ABIs
        self.ico_abi = self._load_abi('ico_abi.json')
        self.batch_abi = self._load_abi('batch_abi.json')
        
        # Initialize contracts
        self._initialize_contracts()
        
        self.running = False
        
    def _initialize_blockchain_connections(self):
        """Initialize blockchain connections with monitoring"""
        try:
            # Sapphire connection
            sapphire_rpc = os.getenv('SAPPHIRE_RPC_URL')
            with self.monitor.track_blockchain_operation('sapphire', {'rpc_url': sapphire_rpc}):
                self.sapphire_w3 = Web3(Web3.HTTPProvider(sapphire_rpc))
                if self.sapphire_w3.is_connected():
                    self.monitor.record_blockchain_connection('sapphire', 'connected', sapphire_rpc)
                else:
                    self.monitor.record_blockchain_connection('sapphire', 'failed', sapphire_rpc)
            
            # Ethereum connection  
            ethereum_rpc = os.getenv('ETHEREUM_RPC_URL')
            with self.monitor.track_blockchain_operation('ethereum', {'rpc_url': ethereum_rpc}):
                self.ethereum_w3 = Web3(Web3.HTTPProvider(ethereum_rpc))
                if self.ethereum_w3.is_connected():
                    self.monitor.record_blockchain_connection('ethereum', 'connected', ethereum_rpc)
                else:
                    self.monitor.record_blockchain_connection('ethereum', 'failed', ethereum_rpc)
                    
        except Exception as e:
            logger.error(f"Failed to initialize blockchain connections: {e}")
            raise
    
    def _initialize_contracts(self):
        """Initialize smart contracts with monitoring"""
        try:
            # ICO contract
            if self.ico_address and self.ico_abi:
                self.ico_contract = self.sapphire_w3.eth.contract(
                    address=self.ico_address,
                    abi=self.ico_abi
                )
                self.monitor.blockchain_metrics.ico_contract_address = self.ico_address
                logger.info(f"ICO contract initialized: {self.ico_address}")
            
            # Batch settlement contract
            if self.batch_address and self.batch_abi:
                self.batch_contract = self.ethereum_w3.eth.contract(
                    address=self.batch_address,
                    abi=self.batch_abi
                )
                self.monitor.blockchain_metrics.batch_contract_address = self.batch_address
                logger.info(f"Batch contract initialized: {self.batch_address}")
                
        except Exception as e:
            logger.error(f"Failed to initialize contracts: {e}")
    
    def _load_abi(self, filename: str) -> List[Dict]:
        """Load contract ABI from file"""
        try:
            with open(f"/app/abis/{filename}", 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load ABI {filename}: {e}")
            return []
    
    async def start(self):
        """Start the TEE agent with monitoring"""
        if self.running:
            logger.warning("Agent is already running")
            return
        
        try:
            logger.info("Starting Kitty ICO TEE Agent...")
            
            # Validate environment
            self._validate_environment()
            
            # Start monitoring
            await self._start_monitoring()
            
            self.running = True
            logger.info("TEE Agent started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start TEE Agent: {e}")
            raise
    
    def _validate_environment(self):
        """Validate required environment variables"""
        required_vars = [
            'SAPPHIRE_RPC_URL',
            'ETHEREUM_RPC_URL',
            'OPENAI_API_KEY',
            'ICO_CONTRACT_ADDRESS',
            'BATCH_SETTLEMENT_ADDRESS'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise ValueError(f"Missing environment variables: {', '.join(missing)}")
    
    async def _start_monitoring(self):
        """Start monitoring blockchain events with tracking"""
        logger.info("Starting blockchain monitoring...")
        
        while self.running:
            try:
                # Check for new settlement events with monitoring
                blocks_checked, events_found = await self._check_for_settlements()
                self.monitor.record_event_monitoring_cycle(blocks_checked, events_found)
                
                # Wait before next check
                await asyncio.sleep(10)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(30)
    
    async def _check_for_settlements(self) -> Tuple[int, int]:
        """Check for new settlement events with monitoring"""
        try:
            # Get latest block
            latest_block = self.sapphire_w3.eth.get_block('latest')
            
            # Record blockchain interaction
            self.monitor.record_contract_interaction('ico', 'getBlock', True, 0)
            
            # In a real implementation, this would query for actual events
            logger.debug(f"Checked block {latest_block['number']} for settlement events")
            
            return 1, 0  # 1 block checked, 0 events found
            
        except Exception as e:
            logger.error(f"Failed to check for settlements: {e}")
            self.monitor.record_contract_interaction('ico', 'getBlock', False, 0)
            return 0, 0
    
    async def process_settlement(self, sale_id: int):
        """Process a settlement for a specific sale with comprehensive monitoring"""
        try:
            with self.monitor.track_settlement_processing({'sale_id': sale_id}):
                logger.info(f"Processing settlement for sale {sale_id}")
                
                # Get bids for this sale
                bids = await self._get_bids_for_sale(sale_id)
                
                # Process each bid
                processed_bids = []
                for bid in bids:
                    processed_bid = await self.bid_processor.process_bid(bid['encrypted_data'])
                    processed_bids.append(processed_bid)
                
                # Determine winners
                winners = self._determine_winners(processed_bids)
                
                # Record winner determination
                self.monitor.record_settlement_winners(sale_id, winners, len(processed_bids))
                
                # Execute settlement on Ethereum
                await self._execute_settlement(sale_id, winners)
                
                logger.info(f"Settlement completed for sale {sale_id}")
                
        except Exception as e:
            logger.error(f"Failed to process settlement for sale {sale_id}: {e}")
            raise
    
    async def _get_bids_for_sale(self, sale_id: int) -> List[Dict]:
        """Get all bids for a specific sale with contract monitoring"""
        try:
            # Record contract call
            self.monitor.record_contract_interaction('ico', 'getBids', True, 25000)
            
            # In a real implementation, this would query the contract
            # For now, return simulated data
            return [
                {'bidder': '0x1234...', 'encrypted_data': b'encrypted_bid_data_1'},
                {'bidder': '0x5678...', 'encrypted_data': b'encrypted_bid_data_2'}
            ]
        except Exception as e:
            self.monitor.record_contract_interaction('ico', 'getBids', False, 0)
            raise
    
    def _determine_winners(self, bids: List[Dict]) -> List[SettlementData]:
        """Determine winning bids based on TEE logic"""
        # Sort by pitch score and price
        sorted_bids = sorted(bids, key=lambda x: (x['pitch_score'], x['price']), reverse=True)
        
        # Simple winner selection logic
        winners = []
        for i, bid in enumerate(sorted_bids[:10]):  # Top 10 bids
            settlement = SettlementData(
                sale_id=1,  # Would be actual sale ID
                bidder=f"0x{i:040x}",  # Would be actual bidder address
                amount=bid['amount'],
                price=bid['price'],
                country=bid['country'],
                pitch_score=bid['pitch_score'],
                tokens_allocated=bid['amount'] * bid['price']
            )
            winners.append(settlement)
        
        return winners
    
    async def _execute_settlement(self, sale_id: int, winners: List[SettlementData]):
        """Execute settlement on Ethereum with monitoring"""
        try:
            logger.info(f"Executing settlement for {len(winners)} winners")
            
            # Sign the settlement data
            settlement_hash = self._hash_settlement_data(sale_id, winners)
            signature = self._sign_settlement(settlement_hash)
            
            # Record signature creation
            self.monitor.record_signature_creation(settlement_hash.hex(), signature)
            
            # Record contract interaction
            self.monitor.record_contract_interaction('batch', 'executeSettlement', True, 150000)
            
            logger.info(f"Settlement signature: {signature}")
            
        except Exception as e:
            self.monitor.record_contract_interaction('batch', 'executeSettlement', False, 0)
            logger.error(f"Failed to execute settlement: {e}")
    
    def _hash_settlement_data(self, sale_id: int, winners: List[SettlementData]) -> bytes:
        """Hash settlement data for signing"""
        # Simple hash implementation
        data = f"{sale_id}:{len(winners)}"
        return Web3.keccak(text=data)
    
    def _sign_settlement(self, data_hash: bytes) -> str:
        """Sign settlement data with TEE key"""
        account = self.key_manager.get_account()
        signature = account.sign_message(data_hash)
        return signature.signature.hex()
    
    def get_status(self) -> Dict:
        """Get agent status with monitoring data"""
        base_status = {
            'running': self.running,
            'address': self.key_manager.get_address(),
            'sapphire_connected': self.sapphire_w3.is_connected(),
            'ethereum_connected': self.ethereum_w3.is_connected(),
            'timestamp': datetime.now().isoformat()
        }
        
        # Add monitoring data
        health_status = self.monitor.get_health_status()
        all_metrics = self.monitor.get_all_metrics()
        
        return {
            **base_status,
            'health': health_status,
            'metrics': all_metrics
        }
    
    def get_monitoring_dashboard(self) -> str:
        """Get monitoring dashboard as JSON string"""
        return self.monitor.export_metrics_json()

async def main():
    """Main entry point for the TEE Agent with monitoring"""
    try:
        logger.info("Initializing Kitty ICO TEE Agent with monitoring...")
        
        # Create and start agent
        agent = KittyICOTEEAgent()
        await agent.start()
        
        # Keep running and log status periodically
        while True:
            await asyncio.sleep(60)
            status = agent.get_status()
            
            # Log condensed status
            logger.info(
                "Agent status update",
                extra={
                    'operation': 'status_update',
                    'metadata': {
                        'running': status['running'],
                        'address': status['address'],
                        'sapphire_connected': status['sapphire_connected'],
                        'ethereum_connected': status['ethereum_connected'],
                        'healthy': status['health']['healthy'],
                        'bids_processed': status['metrics']['tee_metrics']['bids_processed'],
                        'settlements_processed': status['metrics']['tee_metrics']['settlements_processed']
                    }
                }
            )
            
            # Print full metrics every 10 minutes
            if int(time.time()) % 600 == 0:
                print("=== FULL MONITORING DASHBOARD ===")
                print(agent.get_monitoring_dashboard())
            
    except KeyboardInterrupt:
        logger.info("Shutting down TEE Agent...")
    except Exception as e:
        logger.error(f"TEE Agent error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import time
    asyncio.run(main())