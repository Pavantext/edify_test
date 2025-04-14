"use client"
import React from "react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ShieldAlert, CheckCircle, XCircle, User, AlertTriangle } from "lucide-react"
import { useAuth } from "@clerk/nextjs"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ContentFlags {
  content_violation: boolean;
  self_harm_detected: boolean;
  extremist_content_detected: boolean;
  child_safety_violation: boolean;
  bias_detected: boolean;
  pii_detected: boolean;
  prompt_injection_detected: boolean;
  fraudulent_intent_detected: boolean;
  misinformation_detected: boolean;
  automation_misuse_detected: boolean;
}

interface Violation {
  id: string
  tool: string
  input: string
  violations: string[]
  username: string
  email: string
  timestamp: string
  moderator_approval: 'not_requested' | 'pending' | 'approved' | 'declined'
  status: 'not_requested' | 'pending' | 'approved' | 'declined'
  content_flags: ContentFlags
  moderator_notes?: string
  user_requested_moderation: boolean
}

interface PaginatedResponse {
  violations: Violation[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  error?: string;
}

// Function to truncate text
function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export default function ModeratorApprovalPage() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 10

  const { orgRole, userId } = useAuth()
  const isModerator = orgRole === "moderator" || orgRole === "org:moderator"
  const isAdmin = orgRole === "org:admin"
  const isEducator = orgRole === "org:educator" || orgRole === "basic"
  const canViewModeration = isModerator || isAdmin || isEducator

  useEffect(() => {
    fetchViolations(currentPage)
  }, [currentPage])

  const fetchViolations = async (page: number) => {
    try {
      const url = isEducator
        ? `/api/moderator/violations?page=${page}&pageSize=${pageSize}&userId=${userId}`
        : `/api/moderator/violations?page=${page}&pageSize=${pageSize}`

      const response = await fetch(url)
      const data: PaginatedResponse = await response.json()
      if (response.ok) {
        setViolations(data.violations)
        setTotalCount(data.totalCount)
      } else {
        console.error('Failed to fetch violations:', data.error)
      }
    } catch (error) {
      console.error('Error fetching violations:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleApprove = async (id: string, notes?: string) => {
    try {
      const response = await fetch(`/api/moderator/violations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moderator_approval: 'approved',
          moderator_notes: notes
        })
      });
      const result = await response.json();

      if (response.ok && result.success) {
        setViolations(violations.map(violation =>
          violation.id === id
            ? { ...violation, ...result.data }
            : violation
        ));
      } else {
        console.error('Failed to approve:', result.error);
      }
    } catch (error) {
      console.error('Error approving violation:', error);
    }
  }

  const handleReject = async (id: string, notes?: string) => {
    try {
      const response = await fetch(`/api/moderator/violations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moderator_approval: 'declined',
          moderator_notes: notes
        })
      });
      const result = await response.json();

      if (response.ok && result.success) {
        setViolations(violations.map(violation =>
          violation.id === id
            ? { ...violation, ...result.data }
            : violation
        ));
      } else {
        console.error('Failed to reject:', result.error);
      }
    } catch (error) {
      console.error('Error rejecting violation:', error);
    }
  }

  const handleRequestModeration = async (id: string) => {
    try {
      const response = await fetch(`/api/moderator/violations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          user_requested_moderation: true,
          moderator_approval: 'pending'
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          console.error('Failed to request moderation:', errorData.error);
        } else {
          console.error('Failed to request moderation:', response.statusText);
        }
        return;
      }

      const result = await response.json();

      if (result.success) {
        setViolations(violations.map(violation =>
          violation.id === id
            ? { ...violation, ...result.data }
            : violation
        ));
      } else {
        console.error('Failed to request moderation:', result.error);
      }
    } catch (error) {
      console.error('Error requesting moderation:', error);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Content Moderation</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isEducator ? "My Content Flags" : "Flagged Content"}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[800px] md:min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] md:w-auto">User</TableHead>
                  <TableHead className="w-[100px] md:w-auto">Tool</TableHead>
                  <TableHead className="w-[200px] md:w-auto">Content</TableHead>
                  <TableHead className="w-[150px] md:w-auto">Violations</TableHead>
                  <TableHead className="w-[150px] md:w-auto">Time</TableHead>
                  <TableHead className="w-[100px] md:w-auto">Status</TableHead>
                  {(isModerator || isEducator) && <TableHead className="w-[100px] md:w-auto">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((violation) => {
                  return (
                    <TableRow key={violation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 md:gap-3">
                          <Avatar className="h-6 w-6 md:h-8 md:w-8">
                            <AvatarFallback>
                              <User className="h-3 w-3 md:h-4 md:w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm md:text-base font-medium">
                              {violation.username}
                              {violation.user_requested_moderation && (
                                <AlertTriangle className="inline-block ml-1 h-4 w-4 text-yellow-500" />
                              )}
                            </span>
                            <span className="text-xs md:text-sm text-muted-foreground">
                              {violation.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm md:text-base">{violation.tool}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="max-w-[150px] md:max-w-[200px] text-sm md:text-base whitespace-pre-wrap break-words">
                                {truncateText(violation.input, 50)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[300px] break-words whitespace-pre-wrap">
                              {truncateText(violation.input, 250)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {violation.violations.map((type) => (
                            <Badge key={type} variant="destructive" className="text-xs md:text-sm">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {new Date(violation.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {violation.user_requested_moderation ? (
                            <>
                              {violation.moderator_approval === 'approved' && (
                                <div className="flex items-center gap-1">
                                  <span className="text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                  </span>
                                  <span className="text-xs text-green-600">Approved</span>
                                </div>
                              )}
                              {violation.moderator_approval === 'declined' && (
                                <div className="flex items-center gap-1">
                                  <span className="text-red-600">
                                    <XCircle className="h-4 w-4" />
                                  </span>
                                  <span className="text-xs text-red-600">Declined</span>
                                </div>
                              )}
                              {(violation.moderator_approval === 'not_requested' ||
                                violation.moderator_approval === 'pending') && (
                                  <span className="text-xs text-muted-foreground">
                                    Pending Review
                                  </span>
                                )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Not Requested
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {(isModerator || isEducator) && (
                        <TableCell>
                          <div className="flex gap-1 md:gap-2">
                            {isModerator && violation.user_requested_moderation &&
                              (violation.moderator_approval === 'not_requested' ||
                                violation.moderator_approval === 'pending') && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 h-7 w-7 md:h-8 md:w-8"
                                    onClick={() => handleApprove(violation.id)}
                                    title="Approve"
                                  >
                                    <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 h-7 w-7 md:h-8 md:w-8"
                                    onClick={() => handleReject(violation.id)}
                                    title="Decline"
                                  >
                                    <XCircle className="h-3 w-3 md:h-4 md:w-4" />
                                  </Button>
                                </>
                              )}
                            {isEducator && !violation.user_requested_moderation && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600"
                                onClick={() => handleRequestModeration(violation.id)}
                                title="Request Review"
                              >
                                Request Review
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-center md:justify-start">
            <Pagination>
              <PaginationContent className="flex-wrap gap-1 md:gap-0">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) handlePageChange(currentPage - 1);
                    }}
                    className={`text-sm md:text-base ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                  })
                  .map((page, index, array) => (
                    <React.Fragment key={page}>
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(page);
                          }}
                          isActive={page === currentPage}
                          className="text-sm md:text-base"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </React.Fragment>
                  ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) handlePageChange(currentPage + 1);
                    }}
                    className={`text-sm md:text-base ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
