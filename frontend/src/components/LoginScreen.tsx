import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Unlock } from 'lucide-react';

interface LoginScreenProps {
    onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
    const [passkey, setPasskey] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPasskey, setShowPasskey] = useState(false);
    const [shake, setShake] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // 自动聚焦输入框
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passkey.trim() || isLoading) return;

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ passkey: passkey.trim() }),
            });

            if (response.ok) {
                onLoginSuccess();
            } else {
                setError('密码错误');
                setShake(true);
                setTimeout(() => setShake(false), 500);
                setPasskey('');
                inputRef.current?.focus();
            }
        } catch {
            setError('连接失败，请检查网络');
            setShake(true);
            setTimeout(() => setShake(false), 500);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center
            bg-gray-100 dark:bg-dark-bg
            transition-colors duration-300"
        >
            {/* 背景装饰 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gray-300/20 dark:bg-gray-700/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gray-400/15 dark:bg-gray-600/10 rounded-full blur-3xl" />
            </div>

            {/* 登录卡片 */}
            <div
                className={`
                    relative w-full max-w-sm mx-4 p-8 rounded-2xl
                    bg-white dark:bg-dark-card
                    border border-gray-200 dark:border-dark-border
                    shadow-lg dark:shadow-2xl dark:shadow-black/50
                    transition-all duration-300
                    ${shake ? 'animate-shake' : ''}
                `}
            >
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <img
                        src="/favicon.svg"
                        alt="RSS Gallery"
                        className="h-16 w-auto"
                    />
                </div>

                {/* 标题 */}
                <h1 className="text-xl font-semibold text-gray-800 dark:text-dark-text text-center mb-1">
                    RSS Gallery
                </h1>
                <p className="text-sm text-gray-400 dark:text-dark-text-secondary text-center mb-8">
                    输入密码以继续
                </p>

                {/* 表单 */}
                <form onSubmit={handleSubmit}>
                    <div className="relative mb-4">
                        <input
                            ref={inputRef}
                            type={showPasskey ? 'text' : 'password'}
                            value={passkey}
                            onChange={(e) => {
                                setPasskey(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="Passkey"
                            autoComplete="current-password"
                            className={`
                                w-full px-4 py-3 pr-12 rounded-xl
                                bg-gray-50 dark:bg-[#1a1a1a]
                                border text-gray-800 dark:text-dark-text
                                placeholder-gray-400 dark:placeholder-gray-600
                                outline-none transition-all duration-200
                                focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600
                                focus:border-gray-400 dark:focus:border-gray-500
                                ${error
                                    ? 'border-red-400/60 dark:border-red-500/50'
                                    : 'border-gray-200 dark:border-dark-border'
                                }
                            `}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPasskey(!showPasskey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1
                                text-gray-400 hover:text-gray-600
                                dark:text-gray-500 dark:hover:text-gray-300
                                transition-colors"
                            tabIndex={-1}
                        >
                            {showPasskey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                        <p className="text-sm text-red-500 dark:text-red-400 text-center mb-4">
                            {error}
                        </p>
                    )}

                    {/* 提交按钮 */}
                    <button
                        type="submit"
                        disabled={!passkey.trim() || isLoading}
                        className={`
                            w-full py-3 rounded-xl font-medium text-sm
                            flex items-center justify-center gap-2
                            transition-all duration-200
                            ${passkey.trim() && !isLoading
                                ? 'bg-gray-800 hover:bg-gray-700 dark:bg-gray-200 dark:hover:bg-gray-300 text-white dark:text-gray-900 cursor-pointer active:scale-[0.98]'
                                : 'bg-gray-200 dark:bg-dark-hover text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            }
                        `}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        ) : (
                            <>
                                <Unlock className="w-4 h-4" />
                                解锁
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* 抖动动画样式 */}
            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
                    20%, 40%, 60%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.5s ease-in-out;
                }
            `}</style>
        </div>
    );
}
