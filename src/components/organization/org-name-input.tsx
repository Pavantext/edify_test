"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface OrgNameInputProps {
  orgName: string
  isChecking: boolean
  onOrgNameChange: (name: string) => void
  onBack: () => void
  onSubmit: () => void
}

export function OrgNameInput({
  orgName,
  isChecking,
  onOrgNameChange,
  onBack,
  onSubmit
}: OrgNameInputProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Enter Organisation Name</h1>
          <p className="mt-2 text-gray-600">Please provide your organisation's name</p>
        </div>
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Organization Name"
            value={orgName}
            onChange={(e) => onOrgNameChange(e.target.value)}
          />
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={onBack}
            >
              Back
            </Button>
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              onClick={onSubmit}
              disabled={!orgName.trim() || isChecking}
            >
              {isChecking ? 'Checking...' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 