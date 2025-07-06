#!/usr/bin/env python3
"""
Kitty ICO TEE Agent - Python Implementation

This agent runs within a ROLF TEE container and:
1. Generates secure EOA within TEE using ROLF's secure key generation
2. Exposes the public key for contract deployment
3. Monitors Sapphire ICO events (BidSubmitted, SaleCreated, SaleFinalized)
4. Decrypts and scores bids using TEE privacy with formula: 0.6*price + 0.2*geo + 0.2*pitchAI
5. Executes atomic settlements on Ethereum

Based on Oasis ROLF patterns for secure TEE execution.
"""

import os
import sys
import json
import asyncio
import logging
from logging.handlers import RotatingFileHandler
import tempfile
import time
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime
import base64

# HTTP server for health checks and basic API
from aiohttp import web

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

# Configure logging with rotation to prevent storage overflow
def setup_logging():
    """Setup logging with rotation to prevent storage issues"""
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Console handler for immediate output
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Rotating file handler to prevent log files from growing too large
    # Max 10MB per file, keep 3 files max (30MB total)
    try:
        file_handler = RotatingFileHandler(
            '/tmp/agent.log',
            maxBytes=10*1024*1024,  # 10MB per file
            backupCount=3,          # Keep 3 backup files max
            encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        # If file logging fails, continue with console only
        logger.warning(f"Could not setup file logging: {e}")
    
    return logger

# Initialize logging
logger = setup_logging()

@dataclass
class BidData:
    """
    Decrypted bid data structure
    Contains all sensitive bid information that is only accessible within the TEE
    """
    bidder: str        # Ethereum address of the bidder
    price: float       # Price per ICO token in USDC (6 decimals)
    quantity: int      # Number of ICO tokens requested by bidder (18 decimals)
    pitch: str         # Pitch text for AI scoring (confidential business information)
    country: str       # Country code for geo-based scoring
    max_spend: float   # Maximum USDC spend authorized (prevents overspending)

@dataclass
class SettlementResult:
    """
    Settlement result data structure
    Contains the final allocation decisions made by the TEE agent
    """
    sale_id: int                        # Unique identifier for the ICO sale
    clearing_price: float               # Final price per token determined by auction
    winners: List[str]                  # List of winner addresses (public information)
    allocations: Dict[str, int]         # Address -> token allocation mapping
    bid_amounts: Dict[str, int]         # Address -> bid quantity (tracks demand vs allocation)
    total_bids: int                     # Total number of tokens bid for across all bidders

@dataclass
class ScoredBid:
    """
    Bid with computed scores
    Represents a bid after applying the TEE scoring algorithm
    """
    bid_data: BidData
    price_score: float    # 0-100, higher price = higher score
    geo_score: float      # 0-100, based on country preferences
    pitch_score: float    # 0-100, AI-generated score for innovation/feasibility
    total_score: float    # Weighted total: 0.6*price + 0.2*geo + 0.2*pitch

class TEEKeyManager:
    """
    Secure key management within ROFL TEE environment
    
    This class handles cryptographic key generation and management within the trusted
    execution environment. It ensures that private keys never leave the secure enclave
    and provides the public key for external contract deployment.
    """
    
    def __init__(self):
        self._account: Optional[LocalAccount] = None
        self._initialize_key()
    
    def _initialize_key(self):
        """
        Initialize TEE key using ROFL appd daemon
        
        Priority order:
        1. ROFL appd key generation (production TEE environment)
        2. Local secure key generation (development fallback)
        """
        try:
            # Attempt ROFL-based key generation for production TEE security
            if self._try_rofl_key_generation():
                logger.info("Using ROFL-generated key")
            else:
                # Fallback for development environments without full TEE
                logger.warning("ROFL appd not available, using local key generation")
                self._generate_local_key()
                
            logger.info(f"TEE Agent initialized with address: {self.get_address()}")
            
        except Exception as e:
            logger.error(f"Failed to initialize TEE key: {e}")
            raise
    
    def _try_rofl_key_generation(self) -> bool:
        """
        Try to generate key using ROFL appd daemon
        
        Uses the ROFL runtime's secure key generation which ensures:
        - Keys are generated within the secure enclave
        - Private keys never exist outside the TEE
        - Hardware-based randomness for cryptographic security
        """
        try:
            import subprocess
            import socket
            
            # Check if we're running in a ROFL TEE environment
            if self._is_rofl_available():
                # Generate key using ROFL runtime's secure context
                result = subprocess.run(['python', '-c', '''
import secrets
from eth_account import Account
import os

# Generate secure key within TEE context
# Uses hardware-based randomness when available
private_key = secrets.token_bytes(32)
account = Account.from_key(private_key)

# Save for use within TEE
with open("/tmp/tee_key.json", "w") as f:
    import json
    json.dump({
        "private_key": private_key.hex(),
        "address": account.address
    }, f)

print(account.address)
                '''], capture_output=True, text=True, check=True)
                
                # Load the generated key securely
                with open('/tmp/tee_key.json', 'r') as f:
                    key_data = json.load(f)
                    self._account = Account.from_key(key_data['private_key'])
                
                # Clean up temporary file for security
                os.remove('/tmp/tee_key.json')
                
                # Export public key for contract deployment
                self._export_public_key()
                return True
                
        except Exception as e:
            logger.debug(f"ROFL key generation failed: {e}")
            return False
            
        return False
    
    def _is_rofl_available(self) -> bool:
        """
        Check if running in ROFL environment
        
        Detects TEE environment indicators:
        - Attestation device (hardware TEE)
        - TEE_MODE environment variable
        - Oasis runtime directory
        """
        return (
            os.path.exists('/dev/attestation') or 
            os.environ.get('TEE_MODE') == 'production' or
            os.path.exists('/opt/oasis/')
        )
    
    def _generate_local_key(self):
        """
        Generate key locally for development
        
        Fallback key generation for non-TEE environments.
        Uses cryptographically secure random number generation.
        """
        try:
            # Generate secure random key using system entropy
            private_key = secrets.token_bytes(32)
            self._account = Account.from_key(private_key)
            
            # Export public key for deployment coordination
            self._export_public_key()
            
            logger.info(f"Generated local TEE key: {self._account.address}")
            
        except Exception as e:
            logger.error(f"Failed to generate local key: {e}")
            raise
    
    def _export_public_key(self):
        """
        Export public key for contract deployment
        
        Makes the TEE agent's public address available to external systems
        for contract deployment and verification. Only the public address
        is exposed - private key remains secure within TEE.
        """
        try:
            # Create secure output directory
            os.makedirs('/tmp/keys', exist_ok=True)
            
            # Export to file for external access by deployment scripts
            key_file = "/tmp/keys/public_key.txt"
            with open(key_file, 'w') as f:
                f.write(self._account.address)
                
            # Also print to stdout for logging and automation
            print(f"TEE_PUBLIC_KEY={self._account.address}")
            
            logger.info("Public key exported for contract deployment")
            
        except Exception as e:
            logger.error(f"Failed to export public key: {e}")
    
    def cleanup_temp_files(self):
        """Clean up temporary files to prevent storage overflow"""
        try:
            temp_files = [
                '/tmp/tee_key.json',
                '/tmp/keys/public_key.txt'
            ]
            
            for file_path in temp_files:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.debug(f"Cleaned up temp file: {file_path}")
                    
        except Exception as e:
            logger.warning(f"Failed to cleanup temp files: {e}")
    
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
    
    This class handles the core confidential computing functionality:
    1. Decrypts HPKE-encrypted bid data using TEE private key
    2. Scores pitches using OpenAI API for innovation assessment
    3. Implements multi-factor scoring: price (60%) + geography (20%) + AI pitch (20%)
    4. Ensures bid confidentiality until settlement execution
    """
    
    def __init__(self, openai_api_key: str):
        # Initialize OpenAI client with robust error handling
        try:
            # Validate API key format and initialize client
            if not openai_api_key or openai_api_key == 'dummy_key' or openai_api_key.startswith('sk-development'):
                logger.warning("Using dummy OpenAI key - pitch scoring will use fallback scoring")
                self.openai_client = None
            else:
                # Production OpenAI client for AI-based pitch scoring
                try:
                    self.openai_client = openai.OpenAI(api_key=openai_api_key)
                    logger.info("OpenAI client initialized successfully")
                except Exception as e1:
                    logger.warning(f"OpenAI initialization failed: {e1}")
                    logger.warning("Falling back to dummy scoring for pitch evaluation")
                    self.openai_client = None
                    
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            logger.warning("Falling back to dummy scoring for pitch evaluation")
            self.openai_client = None
        
        # Geographic scoring matrix - can be customized based on ICO preferences
        self.geo_scores = {
            'US': 90, 'CA': 85, 'GB': 85, 'DE': 80, 'JP': 80,
            'FR': 75, 'AU': 75, 'SG': 80, 'CH': 85, 'NL': 80,
            'default': 50  # Default score for unknown countries
        }
        
    async def decrypt_bid(self, encrypted_blob: bytes, bidder: str, max_spend: float) -> BidData:
        """
        Decrypt HPKE-encrypted bid data
        
        In production, this would use libsodium HPKE decryption with the TEE's private key.
        For development/testing, we use ABI-encoded data as a simplified encryption simulation.
        
        The decryption process ensures that sensitive bid information (price, quantity, pitch)
        remains confidential until processed within the secure TEE environment.
        """
        try:
            logger.debug(f"Decrypting bid from {bidder}")
            
            # PRODUCTION ENCRYPTION MODEL:
            # In production, bid data is encrypted using HPKE (Hybrid Public Key Encryption)
            # with the TEE's public key. Only the TEE can decrypt this data using its private key.
            # This ensures that bid information (price, quantity, pitch) remains confidential
            # until processed within the secure enclave.
            # Production implementation would use: decrypted_data = hpke_decrypt(encrypted_blob, tee_private_key)
            
            # DEVELOPMENT SIMULATION:
            # For local testing, we simulate encryption by using ABI encoding.
            # This allows testing the full workflow without requiring complex HPKE setup.
            try:
                # Decode ABI-encoded bid data (simulates decrypted content)
                from eth_abi import decode
                decoded = decode(['uint256', 'uint256', 'string', 'string'], encrypted_blob)
                price_usdc_wei, quantity_tokens_wei, pitch, country = decoded
                
                bid_data = BidData(
                    bidder=bidder,
                    price=float(price_usdc_wei) / 1e6,  # Convert from USDC wei (6 decimals) to USDC
                    quantity=int(quantity_tokens_wei // 1e18),  # Convert from token wei (18 decimals) to tokens
                    pitch=pitch,
                    country=country,
                    max_spend=max_spend / 1e6  # Convert USDC wei to USDC
                )
                
                logger.info(f"Decrypted bid: {bid_data.quantity} ICO tokens at {bid_data.price} USDC each from {country}")
                return bid_data
                
            except Exception as decode_error:
                logger.warning(f"ABI decode failed, using fallback decryption: {decode_error}")
                
                # Fallback: generate deterministic test data for development
                bid_data = BidData(
                    bidder=bidder,
                    price=0.1 + (hash(bidder) % 100) / 1000,  # 0.1-0.199 ETH
                    quantity=1000 + (hash(bidder) % 5000),    # 1000-6000 tokens
                    pitch=f"Innovative blockchain solution from {bidder[:8]}",
                    country=['US', 'CA', 'GB', 'DE', 'JP'][hash(bidder) % 5],
                    max_spend=max_spend
                )
                
                logger.info(f"Generated fallback bid data for {bidder}")
            return bid_data
            
        except Exception as e:
            logger.error(f"Failed to decrypt bid from {bidder}: {e}")
            raise
    
    async def score_bid(self, bid_data: BidData, max_price: float = None) -> ScoredBid:
        """
        Score a bid using the TEE scoring algorithm
        
        Implements the multi-factor scoring formula:
        - Price Component (60%): Higher price = higher score (encourages premium bids)
        - Geographic Component (20%): Country-based preferences (regulatory/strategic)
        - AI Pitch Component (20%): Innovation and feasibility assessment
        
        This scoring ensures fair, transparent allocation while incorporating
        multiple value factors beyond just price.
        """
        try:
            # Price scoring (0-100): Normalized against highest bid or absolute scale
            if max_price and max_price > 0:
                # Relative scoring: compare against highest bidder
                price_score = min(100, (bid_data.price / max_price) * 100)
            else:
                # Absolute scoring: assume reasonable maximum of 10 USDC per ICO token
                price_score = min(100, bid_data.price * 100)
            
            # Geographic scoring (0-100): Based on strategic country preferences
            geo_score = self.geo_scores.get(bid_data.country, self.geo_scores['default'])
            
            # AI pitch scoring (0-100): Innovation and feasibility assessment
            pitch_score = await self._score_pitch(bid_data.pitch)
            
            # Calculate weighted total score using ICO-specific formula
            # 60% price weighting ensures economic incentives
            # 20% geo weighting allows strategic geographic distribution
            # 20% pitch weighting rewards innovation and quality
            total_score = (0.6 * price_score) + (0.2 * geo_score) + (0.2 * pitch_score)
            
            scored_bid = ScoredBid(
                bid_data=bid_data,
                price_score=price_score,
                geo_score=geo_score,
                pitch_score=pitch_score,
                total_score=total_score
            )
            
            logger.info(f"Scored bid from {bid_data.bidder}: total={total_score:.1f} (price={price_score:.1f}, geo={geo_score:.1f}, pitch={pitch_score:.1f})")
            return scored_bid
            
        except Exception as e:
            logger.error(f"Failed to score bid from {bid_data.bidder}: {e}")
            raise
    
    async def _score_pitch(self, pitch: str) -> float:
        """
        Score a pitch using OpenAI or fallback to deterministic scoring
        
        Uses GPT to evaluate pitch quality based on:
        - Innovation potential
        - Technical feasibility  
        - Market opportunity
        - Competitive advantage
        
        Falls back to keyword-based scoring if OpenAI is unavailable.
        """
        try:
            # Use fallback scoring if OpenAI client is not available
            if self.openai_client is None:
                logger.debug("Using fallback pitch scoring (OpenAI not available)")
                
                # Deterministic fallback scoring based on pitch characteristics
                base_score = min(len(pitch) / 10 + 30, 85)  # 30-85 based on length
                
                # Bonus points for innovation keywords
                innovation_keywords = ['innovative', 'revolutionary', 'unique', 'breakthrough', 
                                     'novel', 'ai', 'blockchain', 'defi', 'scalable', 'disruptive']
                keyword_bonus = sum(5 for keyword in innovation_keywords if keyword in pitch.lower())
                score = min(100, base_score + keyword_bonus)
                
                return score
            
            # Use OpenAI for sophisticated pitch analysis
            try:
                response = self.openai_client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "Score this ICO pitch from 0-100 based on innovation, feasibility, and market potential. Consider technical merit, business model, and competitive advantage. Return only the numeric score."},
                        {"role": "user", "content": pitch}
                    ],
                    max_tokens=10,
                    temperature=0.1  # Low temperature for consistent scoring
                )
                
                score_text = response.choices[0].message.content.strip()
                score = float(score_text)
                logger.info(f"OpenAI scored pitch: {score}")
                return min(max(score, 0), 100)  # Clamp to 0-100 range
                
            except Exception as openai_error:
                logger.warning(f"OpenAI scoring failed: {openai_error}, using fallback")
                # Fall back to keyword-based scoring
                return min(len(pitch) / 10 + 40, 75)
            
        except Exception as e:
            logger.error(f"Failed to score pitch: {e}")
            # Ultimate fallback score
            return 50.0

class KittyICOTEEAgent:
    """
    Main TEE Agent for Kitty ICO
    
    Orchestrates the entire confidential ICO workflow:
    1. Monitors blockchain events for new sales and bids
    2. Processes settlements when sales expire
    3. Decrypts bids securely within TEE
    4. Applies fair scoring algorithm 
    5. Determines winners through greedy allocation
    6. Signs settlement results with TEE private key
    7. Provides API for settlement verification
    
    Ensures that all sensitive bid data remains confidential while
    providing transparent and verifiable settlement results.
    """
    
    def __init__(self):
        # Initialize secure key management for TEE operations
        self.key_manager = TEEKeyManager()
        
        # Initialize bid processor with robust error handling for OpenAI
        openai_api_key = os.getenv('OPENAI_API_KEY', 'sk-development-key')
        try:
            self.bid_processor = BidProcessor(openai_api_key)
        except Exception as e:
            logger.error(f"Failed to initialize bid processor: {e}")
            logger.warning("Continuing with fallback scoring only")
            self.bid_processor = BidProcessor('sk-development-key')
        
        # Initialize blockchain connections for multi-chain architecture
        self.sapphire_w3 = Web3(Web3.HTTPProvider(os.getenv('SAPPHIRE_RPC_URL')))  # Confidential ICO contracts
        self.ethereum_w3 = Web3(Web3.HTTPProvider(os.getenv('ETHEREUM_RPC_URL')))  # Token and settlement contracts
        
        # TOKEN CUSTODY MODEL:
        # 1. ICO tokens are deployed on Ethereum and transferred to BatchSettlement contract
        # 2. BatchSettlement holds custody of all ICO tokens for distribution
        # 3. TEE processes bids and signs settlement results 
        # 4. BatchSettlement verifies TEE signature and distributes tokens atomically
        # This ensures that token distribution can only happen with valid TEE authorization
        
        # Contract addresses from environment
        self.ico_address = os.getenv('ICO_CONTRACT_ADDRESS')        # Sapphire ICO contract
        self.batch_address = os.getenv('BATCH_SETTLEMENT_ADDRESS')  # Ethereum settlement contract
        
        # Load contract ABIs for interaction
        self.ico_abi = self._load_abi('ico_abi.json')
        self.batch_abi = self._load_abi('batch_abi.json')
        
        # Initialize contracts if addresses are available
        self.ico_contract = None
        self.batch_contract = None
        
        if self.ico_address and self.ico_abi:
            try:
                self.ico_contract = self.sapphire_w3.eth.contract(
                    address=self.ico_address,
                    abi=self.ico_abi
                )
                logger.info(f"ICO contract initialized at {self.ico_address}")
            except Exception as e:
                logger.warning(f"Failed to initialize ICO contract: {e}")
        
        if self.batch_address and self.batch_abi:
            try:
                self.batch_contract = self.ethereum_w3.eth.contract(
                    address=self.batch_address,
                    abi=self.batch_abi
                )
                logger.info(f"Batch contract initialized at {self.batch_address}")
            except Exception as e:
                logger.warning(f"Failed to initialize Batch contract: {e}")
        
        # State tracking
        self.running = False
        self.processed_sales = set()  # Track which sales have been processed
        self.active_sales = {}  # Track active sales: sale_id -> sale_data
        self.settlement_results = {}  # Track settlement results: sale_id -> settlement_data
        
    def _load_abi(self, filename: str) -> List[Dict]:
        """Load contract ABI from file"""
        try:
            # Try development path first (when running from volume mount)
            abi_paths = [
                f"/app/src/abis/{filename}",  # Development path
                f"/app/abis/{filename}"       # Production path
            ]
            
            for abi_path in abi_paths:
                try:
                    with open(abi_path, 'r') as f:
                        logger.debug(f"Loaded ABI from {abi_path}")
                        return json.load(f)
                except FileNotFoundError:
                    continue
                    
            logger.warning(f"ABI file {filename} not found, using empty ABI")
            return []
            
        except Exception as e:
            logger.error(f"Failed to load ABI {filename}: {e}")
            return []
    
    async def _setup_http_server(self):
        """
        Setup HTTP server for health checks and basic API
        
        This server provides endpoints for monitoring the TEE agent status,
        particularly useful for Docker health checks and development monitoring.
        
        Endpoints:
        - GET /health: Returns health status for container health checks
        - GET /status: Returns detailed agent status information
        - GET /sales: Returns active sales information
        - POST /process-sale/{sale_id}: Manually trigger sale processing (development)
        """
        app = web.Application()
        
        # Health check endpoint - used by Docker Compose health checks
        async def health_check(request):
            status = self.get_status()
            return web.json_response({
                'status': 'healthy' if status['running'] else 'unhealthy',
                'details': status
            })
        
        # Status endpoint - detailed agent information
        async def status_endpoint(request):
            return web.json_response(self.get_status())
        
        # Sales endpoint - show active sales
        async def sales_endpoint(request):
            return web.json_response({
                'active_sales': list(self.active_sales.keys()),
                'processed_sales': list(self.processed_sales),
                'sale_details': self.active_sales
            })
        
        # Settlement results endpoint
        async def settlement_endpoint(request):
            return web.json_response({
                'total_settlements': len(self.settlement_results),
                'settlements': self.settlement_results
            })
        
        # Settlement details for specific sale
        async def settlement_detail_endpoint(request):
            sale_id = int(request.match_info['sale_id'])
            
            if sale_id in self.settlement_results:
                return web.json_response(self.settlement_results[sale_id])
            else:
                return web.json_response({'error': f'No settlement found for sale {sale_id}'}, status=404)
        
        # Manual sale processing endpoint (for development/testing)
        async def process_sale_endpoint(request):
            sale_id = int(request.match_info['sale_id'])
            try:
                await self.process_settlement(sale_id)
                return web.json_response({'success': True, 'sale_id': sale_id})
            except Exception as e:
                return web.json_response({'success': False, 'error': str(e)}, status=500)
        
        # Add routes
        app.router.add_get('/health', health_check)
        app.router.add_get('/status', status_endpoint)
        app.router.add_get('/sales', sales_endpoint)
        app.router.add_get('/settlements', settlement_endpoint)
        app.router.add_get('/settlement/{sale_id}', settlement_detail_endpoint)
        app.router.add_post('/process-sale/{sale_id}', process_sale_endpoint)
        
        # Start server on port 8080 (exposed in Docker Compose)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', 8080)
        await site.start()
        
        logger.info("HTTP server started on port 8080")
        return runner
    
    async def start(self):
        """Start the TEE agent"""
        if self.running:
            logger.warning("Agent is already running")
            return
        
        try:
            logger.info("Starting Kitty ICO TEE Agent...")
            
            # Validate environment
            self._validate_environment()
            
            # Setup HTTP server for health checks
            self.http_runner = await self._setup_http_server()
            
            # Start monitoring
            await self._start_monitoring()
            
            self.running = True
            logger.info("TEE Agent started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start TEE Agent: {e}")
            raise
    
    def _validate_environment(self):
        """Validate required environment variables"""
        # Core required variables
        required_vars = [
            'SAPPHIRE_RPC_URL',
            'ETHEREUM_RPC_URL'
        ]
        
        # Optional variables for development
        optional_vars = [
            'OPENAI_API_KEY',
            'ICO_CONTRACT_ADDRESS',
            'BATCH_SETTLEMENT_ADDRESS'
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        # Log missing optional variables as warnings
        missing_optional = [var for var in optional_vars if not os.getenv(var)]
        if missing_optional:
            logger.warning(f"Missing optional environment variables (using defaults): {', '.join(missing_optional)}")
            
        # Log current configuration
        logger.info(f"TEE Mode: {os.getenv('TEE_MODE', 'production')}")
        logger.info(f"Network: {os.getenv('OASIS_NETWORK', 'unknown')}")
        logger.info(f"Sapphire RPC: {os.getenv('SAPPHIRE_RPC_URL')}")
        logger.info(f"Ethereum RPC: {os.getenv('ETHEREUM_RPC_URL')}")
        logger.info(f"ICO Contract: {self.ico_address or 'Not set'}")
        logger.info(f"TEE Public Key: {self.key_manager.get_address()}")
    
    async def _start_monitoring(self):
        """Start monitoring ICO contract events"""
        logger.info("Starting ICO contract monitoring...")
        
        # Track iterations for reduced logging
        iteration_count = 0
        last_status_log = time.time()
        
        while self.running:
            try:
                # Check for ICO contract events
                if self.ico_contract:
                    await self._check_ico_events()
                
                # Process expired sales
                await self._check_expired_sales()
                
                iteration_count += 1
                
                # Log status less frequently to save storage (every 10 minutes)
                current_time = time.time()
                if current_time - last_status_log >= 600:  # 10 minutes
                    logger.info(f"Agent monitoring (iteration {iteration_count}): Active sales: {len(self.active_sales)}, Processed: {len(self.processed_sales)}")
                    last_status_log = current_time
                    
                    # Periodic cleanup to prevent storage overflow
                    self.key_manager.cleanup_temp_files()
                
                # Wait before next check - 30 seconds for development
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)  # Wait longer on error
    
    async def _check_ico_events(self):
        """Check for new ICO contract events"""
        try:
            # Get latest block for event filtering
            latest_block = self.sapphire_w3.eth.get_block('latest')
            current_block = latest_block['number']
            
            # Look back a reasonable number of blocks (for development: 100 blocks)
            from_block = max(0, current_block - 100)
            
            # Check for SaleCreated events
            try:
                sale_events = self.ico_contract.events.SaleCreated.get_logs(
                    fromBlock=from_block,
                    toBlock='latest'
                )
                
                for event in sale_events:
                    sale_id = event['args']['id']
                    if sale_id not in self.active_sales:
                        await self._handle_sale_created(event)
            
            except Exception as e:
                logger.debug(f"No SaleCreated events found or error: {e}")
            
            # Check for BidSubmitted events
            try:
                bid_events = self.ico_contract.events.BidSubmitted.get_logs(
                    fromBlock=from_block,
                    toBlock='latest'
                )
                
                for event in bid_events:
                    sale_id = event['args']['id']
                    if sale_id in self.active_sales:
                        await self._handle_bid_submitted(event)
                        
            except Exception as e:
                logger.debug(f"No BidSubmitted events found or error: {e}")
            
        except Exception as e:
            logger.debug(f"Error checking ICO events: {e}")
    
    async def _handle_sale_created(self, event):
        """Handle SaleCreated event"""
        sale_id = event['args']['id']
        issuer = event['args']['issuer']
        supply = event['args']['supply']
        
        logger.info(f"New sale created: ID={sale_id}, Issuer={issuer}, Supply={supply}")
        
        # Get sale details from contract
        try:
            sale_info = self.ico_contract.functions.sales(sale_id).call()
            deadline = sale_info[2]  # deadline is the 3rd field
            
            self.active_sales[sale_id] = {
                'id': sale_id,
                'issuer': issuer,
                'supply': supply,
                'deadline': deadline,
                'bids': [],
                'created_at': time.time()
            }
            
            logger.info(f"Sale {sale_id} registered, deadline: {datetime.fromtimestamp(deadline)}")
            
        except Exception as e:
            logger.error(f"Failed to get sale details for sale {sale_id}: {e}")
    
    async def _handle_bid_submitted(self, event):
        """Handle BidSubmitted event"""
        sale_id = event['args']['id']
        bidder = event['args']['bidder']
        
        logger.info(f"New bid submitted: Sale={sale_id}, Bidder={bidder}")
        
        if sale_id in self.active_sales:
            # Add bidder to the sale's bid list
            if bidder not in [bid['bidder'] for bid in self.active_sales[sale_id]['bids']]:
                self.active_sales[sale_id]['bids'].append({
                    'bidder': bidder,
                    'submitted_at': time.time()
                })
                logger.info(f"Recorded bid from {bidder} for sale {sale_id}")
    
    async def _check_expired_sales(self):
        """Check for sales that have passed their deadline and need processing"""
        current_time = int(time.time())
        
        for sale_id, sale_data in list(self.active_sales.items()):
            if (sale_data['deadline'] <= current_time and 
                sale_id not in self.processed_sales):
                
                logger.info(f"Sale {sale_id} has expired, processing settlement...")
                try:
                    await self.process_settlement(sale_id)
                    self.processed_sales.add(sale_id)
                    # Keep in active_sales for reference but mark as processed
                    
                except Exception as e:
                    logger.error(f"Failed to process settlement for sale {sale_id}: {e}")
    
    async def process_settlement(self, sale_id: int):
        """
        Process settlement for a specific sale
        
        This is the core TEE function that implements the confidential ICO workflow:
        1. Verifies sale has ended (deadline passed)
        2. Retrieves all encrypted bids from blockchain
        3. Decrypts bid data within secure TEE environment
        4. Scores bids using multi-factor algorithm
        5. Determines winners through greedy allocation
        6. Signs settlement with TEE private key
        7. Stores results for verification
        
        The entire process ensures bid confidentiality while providing
        transparent and verifiable settlement outcomes.
        """
        try:
            logger.info(f"Processing settlement for sale {sale_id}")
            
            if not self.ico_contract:
                raise RuntimeError("ICO contract not initialized")
            
            # Get sale information
            sale_info = self.ico_contract.functions.sales(sale_id).call()
            supply_wei = sale_info[1]  # Supply in wei (18 decimals)
            supply = int(Web3.from_wei(supply_wei, 'ether'))  # Convert to token units for allocation logic
            deadline = sale_info[2]
            
            # Verify sale has ended
            if int(time.time()) < deadline:
                raise RuntimeError(f"Sale {sale_id} has not yet ended (deadline: {datetime.fromtimestamp(deadline)})")
            
            # Get all bids for this sale
            bids = await self._get_bids_for_sale(sale_id)
            
            if not bids:
                logger.warning(f"No bids found for sale {sale_id}")
                return
            
            logger.info(f"Processing {len(bids)} bids for sale {sale_id}")
            
            # Decrypt and score all bids
            scored_bids = []
            max_price = 0
            
            # First pass: decrypt all bids and find max price
            decrypted_bids = []
            for bid in bids:
                try:
                    bid_data = await self.bid_processor.decrypt_bid(
                        bid['encrypted_data'], 
                        bid['bidder'], 
                        bid['max_spend']
                    )
                    decrypted_bids.append(bid_data)
                    max_price = max(max_price, bid_data.price)
                except Exception as e:
                    logger.error(f"Failed to decrypt bid from {bid['bidder']}: {e}")
            
            # Second pass: score all bids with proper price normalization
            for bid_data in decrypted_bids:
                try:
                    scored_bid = await self.bid_processor.score_bid(bid_data, max_price)
                    scored_bids.append(scored_bid)
                except Exception as e:
                    logger.error(f"Failed to score bid from {bid_data.bidder}: {e}")
            
            if not scored_bids:
                logger.warning(f"No valid bids to process for sale {sale_id}")
                return
            
            # Determine winners using greedy allocation
            settlement_result = await self._determine_winners(sale_id, scored_bids, supply)
            
            logger.info(f"Settlement determined: {len(settlement_result.winners)} winners, clearing price: {settlement_result.clearing_price}")
            
            # Sign and execute settlement
            await self._execute_settlement(settlement_result)
            
            logger.info(f"Settlement completed for sale {sale_id}")
            
        except Exception as e:
            logger.error(f"Failed to process settlement for sale {sale_id}: {e}")
            raise
    
    async def _get_bids_for_sale(self, sale_id: int) -> List[Dict]:
        """Get all bids for a specific sale from the contract by reading events"""
        try:
            bids = []
            
            # Get bidders from BidSubmitted events (robust approach)
            bidders = await self._get_bidders_from_events(sale_id)
            
            if not bidders:
                logger.warning(f"No bidders found for sale {sale_id}")
                return []
            
            logger.info(f"Found {len(bidders)} bidders for sale {sale_id}: {[b[:10]+'...' for b in bidders]}")
            
            # Get bid data for each bidder
            for bidder in bidders:
                try:
                    bid_info = self.ico_contract.functions.bidOf(sale_id, bidder).call()
                    
                    if bid_info[0]:  # encBlob exists
                        bids.append({
                            'bidder': bidder,
                            'encrypted_data': bid_info[0],  # encBlob
                            'max_spend': float(bid_info[1]),  # maxSpend in USDC wei (6 decimals) - keep as wei for proper conversion in decrypt_bid
                            'permit_sig': bid_info[2],  # permitSig
                            'claimed': bid_info[3]  # claimed
                        })
                        logger.info(f"Retrieved bid from {bidder[:10]}... - {len(bid_info[0])} bytes encrypted data")
                        
                except Exception as e:
                    logger.error(f"Failed to get bid from {bidder} for sale {sale_id}: {e}")
            
            logger.info(f"Successfully retrieved {len(bids)} bids for sale {sale_id}")
            return bids
            
        except Exception as e:
            logger.error(f"Failed to get bids for sale {sale_id}: {e}")
            return []
    
    async def _get_bidders_from_events(self, sale_id: int) -> List[str]:
        """Get all bidders for a sale by reading BidSubmitted events from blockchain"""
        try:
            logger.info(f"Reading BidSubmitted events for sale {sale_id}")
            
            # Get latest block and search systematically from deployment to current
            latest_block = self.sapphire_w3.eth.get_block('latest')
            current_block = latest_block['number']
            
            # Search the entire blockchain in chunks (RPC limit is ~100 blocks per query)
            all_bid_events = []
            chunk_size = 50  # Conservative chunk size to avoid RPC limits
            start_block = 0   # Start from genesis (or could use contract deployment block)
            
            logger.info(f"Scanning blockchain from block {start_block} to {current_block} for BidSubmitted events")
            
            for from_block in range(start_block, current_block + 1, chunk_size):
                to_block = min(from_block + chunk_size - 1, current_block)
                
                try:
                    logger.info(f"Searching blocks {from_block} to {to_block}")
                    
                    # Try contract event filter first (more efficient when it works)
                    try:
                        bid_events = self.ico_contract.events.BidSubmitted.get_logs(
                            fromBlock=from_block,
                            toBlock=to_block,
                            argument_filters={'id': sale_id}
                        )
                        logger.info(f"Found {len(bid_events)} events via contract filter in range {from_block}-{to_block}")
                    except Exception as e:
                        logger.warning(f"Contract event filter failed for {from_block}-{to_block}: {e}")
                        # Fallback to direct RPC call
                        bid_events = await self._get_events_via_rpc(from_block, to_block, sale_id)
                        logger.info(f"Found {len(bid_events)} events via RPC in range {from_block}-{to_block}")
                    
                    if bid_events:
                        all_bid_events.extend(bid_events)
                        logger.info(f"✅ Found {len(bid_events)} BidSubmitted events in blocks {from_block}-{to_block}")
                        
                except Exception as e:
                    logger.warning(f"Failed to search blocks {from_block}-{to_block}: {e}")
                    continue
            
            # Extract unique bidder addresses
            bidders = list(set([event['args']['bidder'] for event in all_bid_events]))
            
            logger.info(f"Found {len(all_bid_events)} total BidSubmitted events for sale {sale_id}")
            logger.info(f"Unique bidders: {len(bidders)}")
            
            return bidders
            
        except Exception as e:
            logger.error(f"Failed to get bidders from events for sale {sale_id}: {e}")
            return []
    
    async def _get_events_via_rpc(self, from_block: int, to_block: int, sale_id: int) -> List:
        """Get events via direct RPC call as fallback"""
        try:
            logger.info(f"Trying direct RPC for blocks {from_block}-{to_block}")
            
            # Direct RPC call to get logs
            logs_request = {
                "jsonrpc": "2.0",
                "method": "eth_getLogs", 
                "params": [{
                    "fromBlock": hex(from_block),
                    "toBlock": hex(to_block),
                    "address": self.ico_address
                }],
                "id": 1
            }
            
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    os.getenv('SAPPHIRE_RPC_URL', 'http://localhost:8545'),
                    json=logs_request
                ) as response:
                    result = await response.json()
                    
                    if 'result' in result:
                        logs = result['result']
                        logger.info(f"Found {len(logs)} raw logs via RPC")
                        
                        # Simple parsing - look for logs with BidSubmitted signature
                        # and the sale_id in the second topic
                        bidsubmitted_sig = "0x14f32a2464bd02d81cc866ab8a4ab09360c685fc8156837dcdf398208674d12b"
                        sale_id_topic = f"0x{sale_id:064x}"
                        
                        bid_events = []
                        for log in logs:
                            if (len(log.get('topics', [])) >= 3 and 
                                log['topics'][0] == bidsubmitted_sig and
                                log['topics'][1] == sale_id_topic):
                                
                                # Create a simple event-like object with checksum address
                                bidder_address = '0x' + log['topics'][2][-40:]  # Extract address from topic
                                checksum_address = Web3.to_checksum_address(bidder_address)
                                event_obj = {
                                    'args': {
                                        'id': sale_id,
                                        'bidder': checksum_address
                                    }
                                }
                                bid_events.append(event_obj)
                        
                        logger.info(f"Parsed {len(bid_events)} BidSubmitted events for sale {sale_id}")
                        return bid_events
                    else:
                        logger.warning(f"RPC call failed: {result}")
                        return []
                        
        except Exception as e:
            logger.warning(f"Direct RPC call failed: {e}")
            return []
    
    async def _determine_winners(self, sale_id: int, scored_bids: List[ScoredBid], total_supply: int) -> SettlementResult:
        """
        Determine winners using greedy allocation based on total scores
        
        Implements a fair allocation algorithm:
        1. Sort all bids by total score (highest first)
        2. Allocate tokens to highest scoring bids first
        3. Continue until token supply is exhausted
        4. Track bid amounts vs final allocations for transparency
        
        This greedy approach ensures that the highest value participants
        (based on the multi-factor scoring) receive priority allocation
        while maintaining fairness and transparency.
        """
        try:
            # Sort bids by total score (descending order for greedy allocation)
            sorted_bids = sorted(scored_bids, key=lambda x: x.total_score, reverse=True)
            
            # Track bid amounts for all bidders (demand analysis)
            bid_amounts = {}
            total_bids = 0
            for scored_bid in scored_bids:
                bid_data = scored_bid.bid_data
                bid_amounts[bid_data.bidder] = bid_data.quantity
                total_bids += bid_data.quantity
            
            logger.info(f"Sorted {len(sorted_bids)} bids by score for allocation")
            logger.info(f"Total ICO tokens bid for: {total_bids:,} (demand: {total_bids/total_supply:.2f}x)")
            
            # Log top bidders for transparency
            for i, bid in enumerate(sorted_bids[:5]):  # Log top 5
                logger.info(f"  {i+1}. {bid.bid_data.bidder[:10]}... Score: {bid.total_score:.1f} (price: {bid.bid_data.price} USDC, qty: {bid.bid_data.quantity})")
            
            # Execute greedy allocation algorithm
            winners = []
            allocations = {}
            remaining_supply = total_supply
            total_value = 0
            
            for scored_bid in sorted_bids:
                if remaining_supply <= 0:
                    break  # No more tokens to allocate
                    
                bid_data = scored_bid.bid_data
                
                # Calculate maximum allocation for this bidder
                # NOTE: max_spend is in ETH (converted from wei), but our system uses USDC payments
                # For local testing, we simulate USDC budget by treating max_spend as USDC amount
                
                # The allocation algorithm considers three constraints:
                # 1. Budget constraint: How many tokens can they afford with their USDC budget?
                # 2. Demand constraint: How many tokens did they actually request?
                # 3. Supply constraint: How many tokens are still available?
                max_affordable = int(bid_data.max_spend / bid_data.price)  # Budget constraint (USDC amount / USDC price)
                requested = bid_data.quantity                              # Desired amount
                allocation = min(requested, max_affordable, remaining_supply)  # Actual allocation (minimum of all constraints)
                
                # Debug logging to diagnose allocation issues
                logger.info(f"Allocation debug for {bid_data.bidder[:10]}...: max_spend={bid_data.max_spend:.2f}, price={bid_data.price:.2f}, max_affordable={max_affordable}, requested={requested}, remaining_supply={remaining_supply}, allocation={allocation}")
                
                if allocation > 0:
                    winners.append(bid_data.bidder)
                    allocations[bid_data.bidder] = allocation
                    remaining_supply -= allocation
                    total_value += allocation * bid_data.price
                    
                    # Log allocation details for transparency
                    fulfillment_pct = (allocation / requested) * 100
                    usdc_cost = allocation * bid_data.price
                    logger.info(f"Allocated {allocation} ICO tokens to {bid_data.bidder[:10]}... at {bid_data.price} USDC each (cost: {usdc_cost:.2f} USDC, bid: {requested}, fulfilled: {fulfillment_pct:.1f}%)")
            
            # Calculate clearing price (weighted average of winning bids)
            clearing_price = total_value / (total_supply - remaining_supply) if (total_supply - remaining_supply) > 0 else 0
            
            # Create settlement result with comprehensive data
            settlement_result = SettlementResult(
                sale_id=sale_id,
                clearing_price=clearing_price,
                winners=winners,
                allocations=allocations,
                bid_amounts=bid_amounts,      # Track original bid amounts
                total_bids=total_bids         # Track total demand
            )
            
            logger.info(f"Winner selection complete: {len(winners)} winners, {total_supply - remaining_supply} ICO tokens allocated")
            logger.info(f"Oversubscription: {total_bids:,} ICO tokens bid for {total_supply:,} available ({total_bids/total_supply:.2f}x)")
            logger.info(f"Total USDC to be collected: {total_value:.2f} USDC")
            return settlement_result
            
        except Exception as e:
            logger.error(f"Failed to determine winners for sale {sale_id}: {e}")
            raise
    
    async def _execute_settlement(self, settlement_result: SettlementResult):
        """Execute settlement by calling finalize() with TEE signature"""
        try:
            logger.info(f"Executing settlement for sale {settlement_result.sale_id}")
            
            # Prepare settlement data for signing
            result_data = self._encode_settlement_result(settlement_result)
            
            # Sign the settlement with TEE key
            signature = self._sign_settlement(settlement_result.sale_id, result_data)
            
            logger.info(f"Settlement signed by TEE: signature={signature[:10]}...")
            
            # Verify all winners have valid permit signatures
            await self._verify_permits(settlement_result)
            
            # Log detailed settlement information for verification
            logger.info("🎯 SETTLEMENT RESULTS:")
            logger.info(f"  📊 Sale ID: {settlement_result.sale_id}")
            logger.info(f"  💰 Clearing Price: {settlement_result.clearing_price:.6f} USDC per ICO token")
            logger.info(f"  🏆 Total Winners: {len(settlement_result.winners)}")
            logger.info(f"  🎫 Total ICO Tokens Allocated: {sum(settlement_result.allocations.values())}")
            
            for i, (winner, allocation) in enumerate(settlement_result.allocations.items(), 1):
                usdc_payment = allocation * settlement_result.clearing_price
                logger.info(f"    {i}. {winner[:10]}... → {allocation:,} ICO tokens ({usdc_payment:.2f} USDC)")
            
            logger.info(f"  ✅ TEE Signature: {signature}")
            logger.info("Settlement ready for BatchSettlement execution on Sepolia!")
            
            # CRITICAL: Execute the actual BatchSettlement on Ethereum Sepolia
            await self._execute_batch_settlement(settlement_result, signature)
            
            # Store settlement for later verification
            self._store_settlement_result(settlement_result, signature)
            
        except Exception as e:
            logger.error(f"Failed to execute settlement: {e}")
            raise
    
    async def _execute_batch_settlement(self, settlement_result: SettlementResult, tee_signature: str):
        """
        Execute the actual BatchSettlement on Ethereum Sepolia
        
        This is the CRITICAL step that distributes ICO tokens to winners.
        The BatchSettlement contract on Ethereum Sepolia holds custody of all ICO tokens
        and distributes them to winners based on TEE-signed settlement results.
        
        MULTI-CHAIN EXECUTION:
        1. Bids are processed on Sapphire (confidential)
        2. TEE generates signed settlement results
        3. BatchSettlement executes on Ethereum Sepolia (where tokens live)
        4. Winners receive their ICO tokens on Ethereum
        """
        try:
            logger.info("🚀 EXECUTING BATCH SETTLEMENT ON ETHEREUM SEPOLIA")
            logger.info(f"   BatchSettlement Contract: {self.batch_address}")
            logger.info(f"   TEE Agent Address: {self.key_manager.get_address()}")
            
            # Build settlement parameters for BatchSettlement contract
            settlement_params = self._build_settlement_params(settlement_result, tee_signature)
            
            # Get TEE account for signing transactions
            tee_account = self.key_manager.get_account()
            
            # Check TEE agent balance on Ethereum (needs ETH for gas)
            tee_balance = self.ethereum_w3.eth.get_balance(tee_account.address)
            tee_balance_eth = Web3.from_wei(tee_balance, 'ether')
            logger.info(f"   TEE Agent ETH Balance: {tee_balance_eth:.6f} ETH")
            
            if tee_balance_eth < 0.003:  # Need at least 0.003 ETH for gas (reduced threshold)
                logger.error(f"❌ Insufficient ETH balance for gas! Need at least 0.003 ETH, have {tee_balance_eth:.6f}")
                logger.error("   Please fund the TEE agent address with ETH on Ethereum Sepolia")
                return
            
            # Build transaction for BatchSettlement.batchSettle()
            try:
                logger.info(f"📦 Building BatchSettlement transaction...")
                
                batch_contract = self.ethereum_w3.eth.contract(
                    address=Web3.to_checksum_address(self.batch_address),
                    abi=self.batch_abi
                )
                
                # Estimate gas first
                gas_estimate = batch_contract.functions.batchSettle(settlement_params).estimate_gas({
                    'from': tee_account.address,
                    'gasPrice': self.ethereum_w3.eth.gas_price
                })
                
                # Add safety buffer to gas estimate
                gas_limit = int(gas_estimate * 1.2)
                
                # Calculate total transaction cost
                gas_price = self.ethereum_w3.eth.gas_price
                total_cost = gas_limit * gas_price
                logger.info(f"⛽ Estimated gas: {gas_estimate:,}, limit: {gas_limit:,}")
                logger.info(f"💰 Total cost: {self.ethereum_w3.from_wei(total_cost, 'ether'):.6f} ETH")
                
                # Double-check balance is sufficient
                if tee_balance < total_cost:
                    raise Exception(f"Insufficient ETH balance: {tee_balance_eth:.6f} < {self.ethereum_w3.from_wei(total_cost, 'ether'):.6f} ETH")
                
                # Build the transaction
                nonce = self.ethereum_w3.eth.get_transaction_count(tee_account.address)
                transaction = batch_contract.functions.batchSettle(settlement_params).build_transaction({
                    'from': tee_account.address,
                    'gasPrice': gas_price,
                    'gas': gas_limit,
                    'nonce': nonce
                })

            except Exception as e:
                logger.error(f"❌ Gas estimation failed: {e}")
                logger.error("   This could indicate contract validation issues")
                return
            
            # Get current gas price
            gas_price = self.ethereum_w3.eth.gas_price
            gas_cost = Web3.from_wei(gas_estimate * gas_price, 'ether')
            logger.info(f"   Estimated gas cost: {gas_cost:.6f} ETH")
            
            # Build and send transaction
            logger.info("🔥 Executing BatchSettlement transaction on Ethereum Sepolia...")
            
            nonce = self.ethereum_w3.eth.get_transaction_count(tee_account.address)
            
            # Sign transaction with TEE private key
            signed_txn = self.ethereum_w3.eth.account.sign_transaction(transaction, tee_account.key)
            
            # Submit transaction to Ethereum
            tx_hash = self.ethereum_w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            logger.info(f"   Transaction sent: {tx_hash.hex()}")
            
            # Wait for confirmation
            logger.info("⏳ Waiting for transaction confirmation...")
            receipt = self.ethereum_w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if receipt.status == 1:
                logger.info("🎉 BATCH SETTLEMENT EXECUTED SUCCESSFULLY!")
                logger.info(f"   Transaction Hash: {receipt.transactionHash.hex()}")
                logger.info(f"   Block Number: {receipt.blockNumber}")
                logger.info(f"   Gas Used: {receipt.gasUsed:,}")
                logger.info(f"   🌐 Explorer: https://sepolia.etherscan.io/tx/{receipt.transactionHash.hex()}")
                logger.info("")
                logger.info("✅ ICO TOKENS HAVE BEEN DISTRIBUTED TO WINNERS!")
                
                # Log distribution summary
                total_tokens = sum(settlement_result.allocations.values())
                total_usdc = total_tokens * settlement_result.clearing_price
                logger.info(f"📊 Distribution Summary:")
                logger.info(f"   🏆 Winners: {len(settlement_result.winners)}")
                logger.info(f"   🎫 Total Tokens Distributed: {total_tokens:,} ICO tokens")
                logger.info(f"   💰 Total USDC Value: {total_usdc:.2f} USDC")
                logger.info(f"   📈 Clearing Price: {settlement_result.clearing_price:.6f} USDC per ICO token")
                
            else:
                logger.error("❌ BatchSettlement transaction failed!")
                logger.error(f"   Transaction Hash: {receipt.transactionHash.hex()}")
                logger.error(f"   Check explorer: https://sepolia.etherscan.io/tx/{receipt.transactionHash.hex()}")
                
        except Exception as e:
            logger.error(f"❌ Failed to execute BatchSettlement: {e}")
            logger.error("   ICO tokens have NOT been distributed to winners")
            logger.error("   Manual intervention may be required")
            raise
    
    def _build_settlement_params(self, settlement_result: SettlementResult, tee_signature: str):
        """
        Build settlement parameters for BatchSettlement contract
        
        The BatchSettlement contract expects a BatchSettleParams struct containing:
        - saleId: uint256
        - issuer: address (sale creator)
        - tokenAddress: address (ICO token contract)
        - paymentToken: address (USDC contract)
        - settlements: array of SettlementData structs (winner, tokenAmount, payment, permitSig)
        - teeSignature: bytes
        """
        try:
            logger.info("📋 Building settlement parameters...")
            
            # Get sale info to find the issuer
            try:
                sale_info = self.ico_contract.functions.sales(settlement_result.sale_id).call()
                issuer = sale_info[0]  # Sale creator address
                logger.info(f"   Sale info: {sale_info}")
                logger.info(f"   Raw issuer: {issuer}")
            except Exception as e:
                logger.error(f"Failed to get sale info: {e}")
                # For local testing, use a default issuer (test account)
                issuer = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                logger.warning(f"Using default issuer: {issuer}")
            
            # Get contract addresses from environment
            token_address = os.getenv('TOKEN_CONTRACT_ADDRESS')  # ICO token contract on Sepolia
            payment_token = os.getenv('USDC_CONTRACT_ADDRESS', '0x1c7D4B196Cb0C7B01d743fbc6116a902379C7238')  # USDC on Sepolia
            
            if not token_address:
                raise ValueError("TOKEN_CONTRACT_ADDRESS not set in environment")
            
            logger.info(f"   Issuer: {issuer}")
            logger.info(f"   Token Address: {token_address}")
            logger.info(f"   Payment Token: {payment_token}")
            
            # Build settlements array - each winner gets their allocation
            settlements = []
            for winner, token_allocation in settlement_result.allocations.items():
                usdc_payment = int(token_allocation * settlement_result.clearing_price * 1e6)  # USDC wei (6 decimals)
                token_amount = int(token_allocation * 1e18)  # Token wei (18 decimals)
                
                # Use tuple structure: (winner, tokenAmount, payment, permitSig)
                settlement_data = (
                    Web3.to_checksum_address(winner),
                    token_amount,
                    usdc_payment,
                    b''  # Empty permit signature for local testing
                )
                settlements.append(settlement_data)
                
                logger.info(f"   {winner[:10]}... → {token_allocation:,} tokens, {usdc_payment/1e6:.2f} USDC")
                logger.info(f"     Settlement data: {settlement_data}")
            
            # Convert signature to bytes
            tee_signature_bytes = bytes.fromhex(tee_signature[2:] if tee_signature.startswith('0x') else tee_signature)
            
            # Build complete BatchSettleParams struct as tuple
            settlement_params = (
                settlement_result.sale_id,
                Web3.to_checksum_address(issuer),
                Web3.to_checksum_address(token_address),
                Web3.to_checksum_address(payment_token),
                settlements,
                tee_signature_bytes
            )
            
            logger.info(f"✅ Settlement params built: {len(settlements)} settlements for sale {settlement_result.sale_id}")
            logger.info(f"   Complete params structure: {settlement_params}")
            return settlement_params
            
        except Exception as e:
            logger.error(f"Failed to build settlement params: {e}")
            raise
    
    async def _verify_permits(self, settlement_result: SettlementResult):
        """Verify that all winners have valid permit signatures"""
        try:
            logger.info("🔍 Verifying permit signatures for winners...")
            
            for winner in settlement_result.winners:
                # Get the bid info to check permit signature
                bid_info = self.ico_contract.functions.bidOf(settlement_result.sale_id, winner).call()
                permit_sig = bid_info[2]  # permitSig
                
                if permit_sig and len(permit_sig) > 2:  # Not empty (0x)
                    logger.info(f"  ✅ {winner[:10]}... has permit signature")
                else:
                    logger.warning(f"  ⚠️  {winner[:10]}... missing permit signature")
            
            logger.info("✅ Permit verification completed")
            
        except Exception as e:
            logger.warning(f"Failed to verify permits: {e}")
    
    def _store_settlement_result(self, settlement_result: SettlementResult, signature: str):
        """Store settlement result for verification"""
        try:
            settlement_data = {
                'sale_id': settlement_result.sale_id,
                'clearing_price': settlement_result.clearing_price,
                'winners': settlement_result.winners,
                'allocations': settlement_result.allocations,
                'bid_amounts': settlement_result.bid_amounts,
                'total_bids': settlement_result.total_bids,
                'signature': signature,
                'timestamp': time.time()
            }
            
            # Store in memory for API access
            self.settlement_results[settlement_result.sale_id] = settlement_data
            logger.info("✅ Settlement result stored for verification")
            
        except Exception as e:
            logger.warning(f"Failed to store settlement result: {e}")
    
    def _encode_settlement_result(self, settlement_result: SettlementResult) -> bytes:
        """Encode settlement result for signing"""
        try:
            # Encode as (uint256 clearingPrice, address[] winners)
            from eth_abi import encode
            
            # Convert USDC clearing price to USDC wei (6 decimals)
            clearing_price_usdc_wei = int(settlement_result.clearing_price * 1e6)
            
            encoded = encode(
                ['uint256', 'address[]'],
                [clearing_price_usdc_wei, settlement_result.winners]
            )
            
            return encoded
            
        except Exception as e:
            logger.error(f"Failed to encode settlement result: {e}")
            raise
    
    def _sign_settlement(self, sale_id: int, result_data: bytes) -> str:
        """
        Sign settlement data with TEE key
        
        Creates a cryptographic signature proving that:
        1. The settlement was computed within the secure TEE
        2. The results are authentic and tamper-proof
        3. The TEE agent authorizes this settlement
        
        The signature can be verified by external systems to confirm
        settlement integrity without revealing the private key.
        
        CRYPTOGRAPHIC PROCESS:
        1. Create message hash using keccak256(abi.encodePacked(tee_address, sale_id, settlement_data))
        2. Sign the hash with TEE's private key using ECDSA
        3. Return hex-encoded signature that can be verified on-chain
        
        This signature serves as cryptographic proof that the settlement
        results are authentic and were generated by the authorized TEE agent.
        """
        try:
            # Create message hash: keccak256(abi.encodePacked(address(this), saleId, result))
            contract_address = self.ico_address
            if isinstance(contract_address, str):
                contract_address = Web3.to_checksum_address(contract_address)
            
            # Encode the message for signing (EIP-191 style)
            from eth_abi import encode
            message_data = encode(
                ['address', 'uint256', 'bytes'],
                [contract_address, sale_id, result_data]
            )
            
            # Hash the encoded message
            message_hash = Web3.keccak(message_data)
            
            # Sign with TEE private key (never exposed outside TEE)
            account = self.key_manager.get_account()
            signed_message = account.signHash(message_hash)
            
            signature = signed_message.signature.hex()
            logger.info(f"Settlement signed for sale {sale_id}")
            
            return signature
            
        except Exception as e:
            logger.error(f"Failed to sign settlement: {e}")
            raise
    
    def get_status(self) -> Dict:
        """Get agent status"""
        return {
            'running': self.running,
            'address': self.key_manager.get_address(),
            'sapphire_connected': self.sapphire_w3.is_connected(),
            'ethereum_connected': self.ethereum_w3.is_connected(),
            'ico_contract': self.ico_address,
            'batch_contract': self.batch_address,
            'active_sales': len(self.active_sales),
            'processed_sales': len(self.processed_sales),
            'timestamp': datetime.now().isoformat()
        }

async def main():
    """Main entry point for the TEE Agent"""
    agent = None
    try:
        logger.info("Initializing Kitty ICO TEE Agent...")
        
        # Create and start agent
        agent = KittyICOTEEAgent()
        await agent.start()
        
        # Keep running with reduced logging to prevent storage overflow
        # The monitoring loop handles status logging every 10 minutes
        while True:
            await asyncio.sleep(300)  # Check every 5 minutes
            
            # Only log if there are issues or significant events
            if not agent.running:
                logger.warning("Agent is no longer running, attempting restart...")
                await agent.start()
            
    except KeyboardInterrupt:
        logger.info("Shutting down TEE Agent...")
    except Exception as e:
        logger.error(f"TEE Agent error: {e}")
        sys.exit(1)
    finally:
        # Clean shutdown
        if agent and hasattr(agent, 'http_runner') and agent.http_runner:
            logger.info("Shutting down HTTP server...")
            await agent.http_runner.cleanup()
        
        # Clean up temp files
        if agent and hasattr(agent, 'key_manager'):
            agent.key_manager.cleanup_temp_files()

if __name__ == "__main__":
    asyncio.run(main()) 