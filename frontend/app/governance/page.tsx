'use client'

import { useState } from 'react'
import { Vote, Plus, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useWallet } from '@/lib/hooks/useWallet'
import { formatNumber } from '@/lib/utils'

interface Proposal {
  id: number
  title: string
  description: string
  proposer: string
  type: 'Add Market' | 'Update Fees' | 'Update Leverage' | 'Treasury' | 'Emergency'
  votesFor: number
  votesAgainst: number
  quorum: number
  startTime: Date
  endTime: Date
  executed: boolean
  status: 'Active' | 'Passed' | 'Rejected' | 'Pending'
}

// Mock proposals
const mockProposals: Proposal[] = [
  {
    id: 1,
    title: 'Add Platinum (XPT/USD) Market',
    description: 'Proposal to add a new prediction market for Platinum prices. This would diversify our commodity offerings and attract more traders interested in precious metals beyond gold and silver.',
    proposer: 'account-hash-abc123...',
    type: 'Add Market',
    votesFor: 3500000,
    votesAgainst: 250000,
    quorum: 10000000,
    startTime: new Date('2024-11-15'),
    endTime: new Date('2024-11-22'),
    executed: false,
    status: 'Active',
  },
  {
    id: 2,
    title: 'Reduce Trading Fees to 0.15%',
    description: 'Proposal to reduce maker/taker fees from 0.2% to 0.15% to increase trading volume and competitiveness. Expected to increase volume by 30-40%.',
    proposer: 'account-hash-def456...',
    type: 'Update Fees',
    votesFor: 8500000,
    votesAgainst: 1200000,
    quorum: 10000000,
    startTime: new Date('2024-11-14'),
    endTime: new Date('2024-11-21'),
    executed: false,
    status: 'Pending',
  },
  {
    id: 3,
    title: 'Increase Max Leverage to 15x',
    description: 'Proposal to increase maximum leverage from 10x to 15x for experienced traders. This would be opt-in with additional risk warnings.',
    proposer: 'account-hash-ghi789...',
    type: 'Update Leverage',
    votesFor: 2100000,
    votesAgainst: 5800000,
    quorum: 10000000,
    startTime: new Date('2024-11-10'),
    endTime: new Date('2024-11-17'),
    executed: true,
    status: 'Rejected',
  },
]

export default function GovernancePage() {
  const { isConnected, connect } = useWallet()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)

  const yourVotingPower = 15000 // Mock RWP staked
  const totalVotingPower = 100000000 // 100M total supply

  const handleVote = (proposalId: number, support: boolean) => {
    // TODO: Call smart contract to vote
    console.log('Voting', support ? 'FOR' : 'AGAINST', 'proposal', proposalId)
    setSelectedProposal(null)
  }

  const handleCreateProposal = () => {
    // TODO: Call smart contract to create proposal
    console.log('Creating proposal')
    setShowCreateModal(false)
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-lg mx-auto p-12 text-center">
          <Vote className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Connect your Casper wallet to participate in governance
          </p>
          <Button
            onClick={connect}
            size="lg"
            className="gradient-primary text-white px-8"
          >
            Connect Wallet
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Governance</h1>
        <p className="text-muted-foreground">
          Participate in protocol governance by voting on proposals
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Your Voting Power</div>
          <div className="text-3xl font-bold">{formatNumber(yourVotingPower)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {((yourVotingPower / totalVotingPower) * 100).toFixed(4)}% of total
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Active Proposals</div>
          <div className="text-3xl font-bold text-primary">
            {mockProposals.filter((p) => p.status === 'Active').length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Currently voting</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Total Proposals</div>
          <div className="text-3xl font-bold">{mockProposals.length}</div>
          <div className="text-xs text-muted-foreground mt-1">All time</div>
        </Card>

        <Card className="p-6">
          <div className="text-sm text-muted-foreground mb-1">Participation</div>
          <div className="text-3xl font-bold text-success">67%</div>
          <div className="text-xs text-muted-foreground mt-1">Avg voter turnout</div>
        </Card>
      </div>

      {/* Create Proposal Button */}
      <div className="mb-8">
        <Button
          onClick={() => setShowCreateModal(true)}
          size="lg"
          className="gradient-primary text-white"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Proposal
        </Button>
        <p className="text-sm text-muted-foreground mt-2">
          Requires 10,000 RWP staked • You have {formatNumber(yourVotingPower)} voting power
        </p>
      </div>

      {/* Proposals List */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Proposals</h2>

        {mockProposals.map((proposal) => {
          const totalVotes = proposal.votesFor + proposal.votesAgainst
          const forPercentage = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0
          const againstPercentage = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0
          const quorumPercentage = (totalVotes / proposal.quorum) * 100

          return (
            <Card key={proposal.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold">{proposal.title}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        proposal.status === 'Active'
                          ? 'bg-primary/10 text-primary'
                          : proposal.status === 'Passed'
                          ? 'bg-success/10 text-success'
                          : proposal.status === 'Rejected'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {proposal.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mb-2">
                    {proposal.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Type: {proposal.type}</span>
                    <span>•</span>
                    <span>Proposed by {proposal.proposer.slice(0, 16)}...</span>
                    <span>•</span>
                    <span>
                      {proposal.status === 'Active'
                        ? `Ends ${proposal.endTime.toLocaleDateString()}`
                        : `Ended ${proposal.endTime.toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Voting Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Votes</span>
                  <span className="font-semibold">
                    {formatNumber(totalVotes)} / {formatNumber(proposal.quorum)} required
                  </span>
                </div>

                {/* Quorum Progress */}
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(quorumPercentage, 100)}%` }}
                  />
                </div>

                {/* For/Against Bars */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle className="h-4 w-4" />
                        For
                      </span>
                      <span className="font-semibold">{forPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success transition-all"
                        style={{ width: `${forPercentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatNumber(proposal.votesFor)} votes
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-4 w-4" />
                        Against
                      </span>
                      <span className="font-semibold">{againstPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-destructive transition-all"
                        style={{ width: `${againstPercentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatNumber(proposal.votesAgainst)} votes
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {proposal.status === 'Active' && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => setSelectedProposal(proposal)}
                    className="gradient-primary text-white"
                  >
                    <Vote className="h-4 w-4 mr-2" />
                    Vote
                  </Button>
                  <Button variant="outline">View Details</Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Voting Modal */}
      {selectedProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Vote on Proposal</h2>
            <h3 className="text-lg font-semibold mb-2">{selectedProposal.title}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {selectedProposal.description}
            </p>

            <div className="p-4 rounded-lg bg-muted/50 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Your voting power</span>
                <span className="font-semibold">{formatNumber(yourVotingPower)} RWP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Voting deadline</span>
                <span className="font-semibold">
                  {selectedProposal.endTime.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleVote(selectedProposal.id, false)}
                variant="outline"
                className="py-8 border-destructive text-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-5 w-5 mr-2" />
                Vote Against
              </Button>
              <Button
                onClick={() => handleVote(selectedProposal.id, true)}
                className="py-8 gradient-success text-white"
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Vote For
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={() => setSelectedProposal(null)}
              className="w-full mt-3"
            >
              Cancel
            </Button>
          </Card>
        </div>
      )}

      {/* Create Proposal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Create Proposal</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Proposal Type</label>
                <select className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                  <option>Add Market</option>
                  <option>Update Fees</option>
                  <option>Update Leverage</option>
                  <option>Update Oracle</option>
                  <option>Treasury</option>
                  <option>Emergency</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Brief, descriptive title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Detailed description of the proposal, including rationale and expected impact..."
                />
              </div>

              <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-start gap-2">
                  <Clock className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-warning mb-1">Voting Timeline</p>
                    <p className="text-muted-foreground">
                      3 day discussion period, then 7 day voting period. Requires 10% quorum and majority approval to pass.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateProposal}
                  className="flex-1 gradient-primary text-white"
                >
                  Submit Proposal
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
