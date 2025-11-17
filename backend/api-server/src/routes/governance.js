const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getCached, setCached } = require('../utils/redis');
const { getGovernanceProposals, getUserStakingInfo } = require('../services/casper-client');

/**
 * GET /api/governance/proposals
 * Get all governance proposals
 */
router.get('/proposals', async (req, res, next) => {
  try {
    const { status } = req.query;

    const cacheKey = `governance:proposals:${status || 'all'}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch from blockchain
    let proposals = await getGovernanceProposals();

    // Determine proposal status
    const now = Date.now() / 1000; // Current time in seconds

    proposals = proposals.map(proposal => {
      let proposalStatus = 'pending';

      if (now < proposal.start_time) {
        proposalStatus = 'pending';
      } else if (now >= proposal.start_time && now <= proposal.end_time) {
        proposalStatus = 'active';
      } else if (proposal.executed) {
        const totalVotes = proposal.votes_for + proposal.votes_against;
        const quorumMet = totalVotes >= proposal.quorum_required;
        const majorityFor = proposal.votes_for > proposal.votes_against;

        proposalStatus = quorumMet && majorityFor ? 'passed' : 'rejected';
      } else {
        proposalStatus = 'ended';
      }

      const totalVotes = proposal.votes_for + proposal.votes_against;
      const quorumPercentage = proposal.quorum_required > 0
        ? (totalVotes / proposal.quorum_required) * 100
        : 0;

      return {
        id: proposal.id,
        proposer: proposal.proposer,
        title: proposal.title,
        description: proposal.description,
        proposalType: proposal.proposal_type,
        votesFor: proposal.votes_for,
        votesAgainst: proposal.votes_against,
        totalVotes,
        quorumRequired: proposal.quorum_required,
        quorumPercentage,
        startTime: proposal.start_time,
        endTime: proposal.end_time,
        executed: proposal.executed,
        status: proposalStatus,
        createdAt: proposal.created_at || proposal.start_time,
        lastUpdated: new Date().toISOString()
      };
    });

    // Apply filters
    if (status) {
      proposals = proposals.filter(p => p.status === status);
    }

    // Sort by ID descending (newest first)
    proposals.sort((a, b) => b.id - a.id);

    const response = {
      success: true,
      count: proposals.length,
      data: proposals,
      summary: {
        total: proposals.length,
        active: proposals.filter(p => p.status === 'active').length,
        passed: proposals.filter(p => p.status === 'passed').length,
        rejected: proposals.filter(p => p.status === 'rejected').length,
        pending: proposals.filter(p => p.status === 'pending').length
      }
    };

    // Cache for 30 seconds
    await setCached(cacheKey, response, 30);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching governance proposals:', error);
    next(error);
  }
});

/**
 * GET /api/governance/proposals/:id
 * Get specific proposal details
 */
router.get('/proposals/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const cacheKey = `governance:proposal:${id}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch all proposals
    const proposals = await getGovernanceProposals();

    // Find specific proposal
    const proposal = proposals.find(p => p.id === parseInt(id));

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Proposal not found'
      });
    }

    // Determine status
    const now = Date.now() / 1000;
    let proposalStatus = 'pending';

    if (now < proposal.start_time) {
      proposalStatus = 'pending';
    } else if (now >= proposal.start_time && now <= proposal.end_time) {
      proposalStatus = 'active';
    } else if (proposal.executed) {
      const totalVotes = proposal.votes_for + proposal.votes_against;
      const quorumMet = totalVotes >= proposal.quorum_required;
      const majorityFor = proposal.votes_for > proposal.votes_against;
      proposalStatus = quorumMet && majorityFor ? 'passed' : 'rejected';
    } else {
      proposalStatus = 'ended';
    }

    const totalVotes = proposal.votes_for + proposal.votes_against;
    const quorumPercentage = proposal.quorum_required > 0
      ? (totalVotes / proposal.quorum_required) * 100
      : 0;

    const forPercentage = totalVotes > 0
      ? (proposal.votes_for / totalVotes) * 100
      : 0;

    const enrichedProposal = {
      id: proposal.id,
      proposer: proposal.proposer,
      title: proposal.title,
      description: proposal.description,
      proposalType: proposal.proposal_type,
      votesFor: proposal.votes_for,
      votesAgainst: proposal.votes_against,
      totalVotes,
      forPercentage,
      againstPercentage: 100 - forPercentage,
      quorumRequired: proposal.quorum_required,
      quorumPercentage,
      startTime: proposal.start_time,
      endTime: proposal.end_time,
      executed: proposal.executed,
      status: proposalStatus,
      timeRemaining: proposalStatus === 'active'
        ? Math.max(0, proposal.end_time - now)
        : 0,
      createdAt: proposal.created_at || proposal.start_time,
      lastUpdated: new Date().toISOString()
    };

    const response = {
      success: true,
      data: enrichedProposal
    };

    // Cache for 30 seconds
    await setCached(cacheKey, response, 30);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching proposal ${req.params.id}:`, error);
    next(error);
  }
});

/**
 * GET /api/governance/:address/voting-power
 * Get voting power for a user
 */
router.get('/:address/voting-power', async (req, res, next) => {
  try {
    const { address } = req.params;

    if (!address || address.length < 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Casper address'
      });
    }

    const cacheKey = `governance:voting-power:${address}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch staking info
    const stakingInfo = await getUserStakingInfo(address);

    if (!stakingInfo) {
      return res.json({
        success: true,
        address,
        data: {
          stakedAmount: 0,
          votingPower: 0,
          lockPeriod: 0,
          multiplier: 1,
          unlockTime: null
        }
      });
    }

    const response = {
      success: true,
      address,
      data: {
        stakedAmount: stakingInfo.staked_amount,
        votingPower: stakingInfo.voting_power,
        lockPeriod: stakingInfo.lock_period,
        stakeTimestamp: stakingInfo.stake_timestamp,
        unlockTime: stakingInfo.stake_timestamp + stakingInfo.lock_period,
        rewardsEarned: stakingInfo.rewards_earned,
        multiplier: stakingInfo.voting_power / stakingInfo.staked_amount,
        lastUpdated: new Date().toISOString()
      }
    };

    // Cache for 10 seconds
    await setCached(cacheKey, response, 10);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching voting power for ${req.params.address}:`, error);
    next(error);
  }
});

module.exports = router;
