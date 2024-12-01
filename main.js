const fs = require("fs");
const axios = require("axios");
const logger = require("./config/logger");
const printBanner = require("./config/banner");
const CountdownTimer = require("./config/countdown");
const colors = require("./config/colors");

// API Constants
const API_ENDPOINTS = {
  BASE_WALLET: "https://pan-wallet-api.pawwallet.app/api/v1",
  BASE_GAME: "https://robot-cat-game-api.pawwallet.app/api/v1",
  WALLET: {
    TRACK: "/wallet/track",
    LOGIN: "/login",
    REFERRAL: "/referral/invited",
  },
  GAME: {
    LOGIN: "/login",
    STATE: "/game",
    SESSION_START: "/player/start-session",
    UPGRADE: "/player/upgrade",
    CLAIM: "/player/claim",
    MISSIONS: "/missions",
    MISSION_VERIFY: "/missions/verify",
    MISSION_CLAIM: "/missions/claim",
    LEADERBOARD: "/game/leaderboard",
    BUY_HEART: "/player/buy-heart",
  },
};

// Game Constants
const GAME_CONSTANTS = {
  SESSION_DURATION: 7200000, // 2 hours in milliseconds
  CLAIM_THRESHOLD: 0.95, // 95% of bag capacity
  RETRY_DELAY: 300000, // 5 minutes in milliseconds
  MIN_HEARTS: 3,
};

class GameAutomation {
  constructor(auth) {
    this.auth = auth;
    this.headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/json",
      Origin: "https://pan-wallet.pawwallet.app",
      Referer: "https://pan-wallet.pawwallet.app/",
      "Sec-Ch-Ua":
        '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A_Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      Authorization: auth,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    };
    this.walletAddress = "";
    this.userId = "";
    this.username = "";
  }

  async createNewWallet() {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.BASE_WALLET}${API_ENDPOINTS.WALLET.TRACK}`,
        { type: "create" },
        { headers: this.headers }
      );

      const loginResponse = await axios.post(
        `${API_ENDPOINTS.BASE_WALLET}${API_ENDPOINTS.WALLET.LOGIN}`,
        {},
        { headers: this.headers }
      );

      this.walletAddress = loginResponse.data.data.walletAddress;
      logger.success(
        `New wallet created: ${colors.custom}${this.walletAddress}${colors.reset}`
      );
      return loginResponse.data;
    } catch (error) {
      logger.error(
        `Wallet creation failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async loginGame() {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.LOGIN}`,
        { walletAddress: this.walletAddress },
        { headers: this.headers }
      );

      this.userId = response.data.data.player.userId;
      this.username = response.data.data.player.username;
      logger.info(
        `Game logged in as: ${colors.accountName}${this.username}${colors.reset} (ID: ${colors.accountInfo}${this.userId}${colors.reset})`
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn("Game account not found, creating new wallet...");
        await this.createNewWallet();
        return this.loginGame();
      }
      logger.error(
        `Game login failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async getGameState() {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.STATE}`,
        { headers: this.headers }
      );
      logger.info(
        `Current level: ${colors.accountInfo}${response.data.data.player.level}${colors.reset}`
      );
      logger.info(
        `Mining speed: ${colors.accountInfo}${response.data.data.player.miningSpeed}${colors.reset}`
      );
      logger.info(
        `Bag capacity: ${colors.accountInfo}${response.data.data.player.bagCap}${colors.reset}`
      );
      logger.info(
        `Hearts: ${colors.accountInfo}${response.data.data.player.hearts}${colors.reset}`
      );
      return response.data;
    } catch (error) {
      logger.error(
        `Get game state failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async buyHearts() {
    try {
      const gameState = await this.getGameState();
      const hearts = gameState.data.player.hearts;

      if (hearts < GAME_CONSTANTS.MIN_HEARTS) {
        const response = await axios.post(
          `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.BUY_HEART}`,
          {
            quantity: 1,
          },
          { headers: this.headers }
        );

        if (response.data.success) {
          logger.success(
            `Successfully purchased hearts. New count: ${colors.accountInfo}${response.data.data.player.hearts}${colors.reset}`
          );
        }
        return response.data;
      }
      return null;
    } catch (error) {
      if (error.response?.status === 500) {
        logger.error(
          `Buy hearts failed: Server error (500) - Operation may be temporarily unavailable`
        );
        return null;
      }
      logger.error(
        `Buy hearts failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async startSession() {
    try {
      const gameState = await this.getGameState();
      const player = gameState.data.player;

      if (player.lastSessionStartTime && player.lastSessionEndTime) {
        const currentTime = new Date();
        const sessionEndTime = new Date(player.lastSessionEndTime);

        if (currentTime < sessionEndTime) {
          logger.info(
            `Player already has active session until: ${colors.timerCount}${sessionEndTime}${colors.reset}`
          );
          logger.info(`Using existing session instead of starting new one`);
          return gameState;
        }
      }

      const response = await axios.post(
        `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.SESSION_START}`,
        { walletAddress: this.walletAddress },
        { headers: this.headers }
      );
      logger.success("New session started for 2 hours");
      return response.data;
    } catch (error) {
      if (error.response?.data?.message === "PLAYER_ALREADY_IN_SESSION") {
        logger.info(
          "Player already has active session, continuing with existing session"
        );
        return await this.getGameState();
      }
      logger.error(
        `Start session failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async upgradePlayer() {
    try {
      const gameState = await this.getGameState();
      const player = gameState.data.player;

      if (player.upgradeCompleteTime) {
        const currentTime = new Date();
        const upgradeCompleteTime = new Date(player.upgradeCompleteTime);

        if (currentTime < upgradeCompleteTime) {
          logger.info(
            `Upgrade already in progress, completing at: ${colors.timerCount}${upgradeCompleteTime}${colors.reset}`
          );
          return gameState;
        }
      }

      const response = await axios.post(
        `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.UPGRADE}`,
        { walletAddress: this.walletAddress },
        { headers: this.headers }
      );

      if (response.data.success) {
        logger.success("Successfully upgraded player");
      }
      return response.data;
    } catch (error) {
      if (error.response?.data?.message === "UPGRADE_IN_PROGRESS") {
        logger.info(
          "Upgrade already in progress, continuing with current state"
        );
        return await this.getGameState();
      }
      logger.error(
        `Upgrade player failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async getMissions() {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.MISSIONS}`,
        { headers: this.headers }
      );

      if (!response.data || !Array.isArray(response.data.data)) {
        logger.warn(
          `Invalid missions response format: ${JSON.stringify(response.data)}`
        );
        return { data: [] };
      }

      return response.data;
    } catch (error) {
      logger.error(
        `Get missions failed: ${colors.error}${error.message}${colors.reset}`
      );
      return { data: [] };
    }
  }

  async processMissions() {
    const missionsResponse = await this.getMissions();
    logger.info("Processing missions...");

    if (!missionsResponse.data || !Array.isArray(missionsResponse.data)) {
      logger.warn(
        "No valid missions data available, skipping missions processing"
      );
      return;
    }

    const hasReferrals = await this.checkReferral();

    for (const mission of missionsResponse.data) {
      if (!mission || !mission.id || !mission.status) {
        logger.warn(`Invalid mission data: ${JSON.stringify(mission)}`);
        continue;
      }

      if (mission.id === 6 && !hasReferrals) {
        logger.warn("Skipping invite friends mission - no referrals found");
        continue;
      }

      if (mission.status === "in_progress") {
        logger.info(
          `Processing mission ${mission.id}: ${colors.taskInProgress}${
            mission.name || "Unknown"
          }${colors.reset}`
        );

        try {
          await this.verifyMission(mission.id);
          await this.buyHearts();

          const updatedMissions = await this.getMissions();
          if (updatedMissions.data && Array.isArray(updatedMissions.data)) {
            const updatedMission = updatedMissions.data.find(
              (m) => m.id === mission.id
            );

            if (updatedMission && updatedMission.status === "completed") {
              await this.claimMissionReward(mission.id);
            }
          }
        } catch (missionError) {
          logger.error(
            `Failed to process mission ${mission.id}: ${colors.error}${missionError.message}${colors.reset}`
          );
          continue;
        }
      }
    }
  }

  async verifyMission(missionId) {
    try {
      return await axios.post(
        `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.MISSION_VERIFY}`,
        { missionId: missionId },
        { headers: this.headers }
      );
    } catch (error) {
      logger.error(
        `Verify mission ${missionId} failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async claimMissionReward(missionId) {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.MISSION_CLAIM}`,
        {
          missionId: missionId,
          code: "",
        },
        { headers: this.headers }
      );
      if (response.data.success) {
        logger.success(
          `Claimed reward for mission ${missionId}: ${colors.custom}${response.data.data.reward} RCAT${colors.reset}`
        );
      }
      return response.data;
    } catch (error) {
      logger.error(
        `Claim mission ${missionId} failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async getLeaderboard() {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.LEADERBOARD}`,
        { headers: this.headers }
      );
      logger.info(
        `Your position: ${colors.accountInfo}${response.data.data.yourPosition}${colors.reset}`
      );
      logger.info(
        `Your total gold: ${colors.custom}${response.data.data.yourTotalGold} RCAT${colors.reset}`
      );
      return response.data;
    } catch (error) {
      logger.error(
        `Get leaderboard failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async claimGold() {
    try {
      const gameState = await this.getGameState();
      const player = gameState.data.player;
      const currentTime = new Date();

      const response = await axios.post(
        `${API_ENDPOINTS.BASE_GAME}${API_ENDPOINTS.GAME.CLAIM}`,
        {},
        { headers: this.headers }
      );

      if (response.data.success) {
        logger.success(
          `Claimed gold: ${colors.custom}${response.data.data.claimedGold} RCAT${colors.reset}`
        );
        logger.success(
          `New balance: ${colors.custom}${response.data.data.player.balance} RCAT${colors.reset}`
        );
      }
      return response.data;
    } catch (error) {
      logger.error(
        `Claim gold failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }

  async checkReferral() {
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.BASE_WALLET}${API_ENDPOINTS.WALLET.REFERRAL}`,
        {
          params: {
            page: 1,
            size: 100,
          },
          headers: this.headers,
        }
      );
      return response.data.data.total > 0;
    } catch (error) {
      logger.error(
        `Check referral failed: ${colors.error}${error.message}${colors.reset}`
      );
      return false;
    }
  }

  async runAutomation() {
    try {
      logger.info("Starting automation...");

      await this.loginGame();
      await this.getGameState();
      await this.buyHearts();
      await this.startSession();
      await this.upgradePlayer();
      await this.processMissions();

      const gameState = await this.getGameState();
      const player = gameState.data.player;

      // Calculate time needed to fill the bag
      const currentTime = new Date();
      const lastAccumulateTime = new Date(player.lastAccumulateTime);
      const miningSpeed = player.miningSpeed;
      const bagCap = player.bagCap;

      // Calculate current unclaimed gold
      const elapsedSeconds = (currentTime - lastAccumulateTime) / 1000;
      const currentGold = elapsedSeconds * miningSpeed + player.unclaimedGold;
      const remainingCapacity = bagCap - currentGold;
      const timeUntilFull = Math.max(
        Math.ceil(remainingCapacity / miningSpeed),
        1
      );

      logger.info(
        `Current gold: ${colors.custom}${currentGold.toFixed(
          2
        )}/${bagCap} RCAT${colors.reset}`
      );
      logger.info(
        `Mining for: ${colors.timerCount}${Math.floor(
          timeUntilFull / 60
        )} minutes${colors.reset}`
      );

      await new Promise((resolve) => {
        const endTime = Date.now() + timeUntilFull * 1000;
        process.stdout.write(`Mining time remaining: ${colors.timerCount}`);

        const interval = setInterval(() => {
          const remaining = Math.ceil((endTime - Date.now()) / 1000);
          if (remaining <= 0) {
            process.stdout.write("\n");
            clearInterval(interval);
            resolve();
          } else {
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            process.stdout.cursorTo(23);
            process.stdout.write(
              `${minutes}:${seconds.toString().padStart(2, "0")}${colors.reset}`
            );
          }
        }, 1000);
      });

      // Claim and finish cycle
      await this.claimGold();
      await this.getLeaderboard();
    } catch (error) {
      logger.error(
        `Automation failed: ${colors.error}${error.message}${colors.reset}`
      );
      throw error;
    }
  }
}

async function startGlobalLoop() {
  try {
    printBanner();

    logger.info("Reading account data...");
    const auth = fs.readFileSync("data.txt", "utf8").trim();
    const automation = new GameAutomation(auth);

    while (true) {
      try {
        await automation.runAutomation();
      } catch (error) {
        logger.error(
          `Mining cycle failed: ${colors.error}${error.message}${colors.reset}`
        );
        logger.warn("Retrying in 5 minutes...");
        await new Promise((resolve) =>
          setTimeout(resolve, GAME_CONSTANTS.RETRY_DELAY)
        );
      }
    }
  } catch (error) {
    logger.error(
      `Main execution failed: ${colors.error}${error.message}${colors.reset}`
    );
    if (error.stack) {
      logger.error(`Stack trace: ${colors.error}${error.stack}${colors.reset}`);
    }
  }
}

async function main() {
  while (true) {
    try {
      await startGlobalLoop();
    } catch (error) {
      logger.error(
        `Critical error in main loop: ${colors.error}${error.message}${colors.reset}`
      );
      logger.warn("Restarting main loop in 5 minutes...");
      await new Promise((resolve) =>
        setTimeout(resolve, GAME_CONSTANTS.RETRY_DELAY)
      );
    }
  }
}

main().catch((error) =>
  logger.error(
    `Unhandled error: ${colors.error}${error.message}${colors.reset}`
  )
);
