import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CustomUser } from "../page";

type KeysToSum = 'amd' | 'bd' | 'csv' | 'cv' | 'ecd' | 'fid' | 'md' | 'pid' | 'pii' | 'shd';

export function Component({ users }: { users: CustomUser[]; }) {
    const keysToSum: KeysToSum[] = ['amd', 'bd', 'csv', 'cv', 'ecd', 'fid', 'md', 'pid', 'pii', 'shd'];
    const totalUses = users.length;
    const totalTokens = users.reduce((acc, user) => acc + user.tokensUsed, 0);
    const totalPrompts = users.reduce((acc, user) => acc + user.noOfPrompts, 0);
    const totalCost = users.reduce((acc, user) => acc + user.totalCost, 0);
    const sumSelectedValues = (arr: CustomUser[], keys: KeysToSum[]) => {
        return arr.reduce((sum, obj) => {
            keys.forEach(key => {
                sum += obj[key];
            });
            return sum;
        }, 0);
    };
    const totalViolation = sumSelectedValues(users, keysToSum);

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalUses}</div>
                    {/* <p className="text-xs text-gray-500 dark:text-gray-400">+10.5% from last month</p> */}
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalPrompts}</div>
                    {/* <p className="text-xs text-gray-500 dark:text-gray-400">+10.5% from last month</p> */}
                </CardContent>
            </Card>
            {/* <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{(totalTokens / 1000000).toFixed(2)}M</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">+80.1% from last month</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">£{totalCost.toFixed(2)}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">+25% from last month</p>
                </CardContent>
            </Card> */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium">Total Violations</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalViolation}</div>
                    {/* <p className="text-xs text-gray-500 dark:text-gray-400">+25% from last month</p> */}
                </CardContent>
            </Card>
        </div>
    );
}
