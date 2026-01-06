"""
Performance Benchmarking Framework
Provides comprehensive performance analysis for trading algorithms
"""

import time
import psutil
import pandas as pd
import numpy as np
from typing import Dict, List, Callable, Any
from dataclasses import dataclass
import matplotlib.pyplot as plt
import seaborn as sns
from functools import wraps
import json
from datetime import datetime
import threading
import logging

@dataclass
class BenchmarkMetrics:
    execution_time: float
    memory_usage: float
    cpu_usage: float
    api_calls: int
    success_rate: float
    error_count: int
    throughput: float  # operations per second

class PerformanceBenchmark:
    """
    Comprehensive performance benchmarking for trading algorithms
    """

    def __init__(self, algorithm_name: str):
        self.algorithm_name = algorithm_name
        self.metrics_history = []
        self.start_time = None
        self.process = psutil.Process()

        # Setup logging
        self.logger = logging.getLogger(f"benchmark_{algorithm_name}")
        logging.basicConfig(level=logging.INFO)

    def start_benchmark(self):
        """Start benchmarking session"""
        self.start_time = time.time()
        self.process.cpu_percent()
        self.logger.info(f"Starting benchmark for {self.algorithm_name}")

    def end_benchmark(self) -> BenchmarkMetrics:
        """End benchmarking and return metrics"""
        if self.start_time is None:
            raise ValueError("Benchmark not started. Call start_benchmark() first.")

        execution_time = time.time() - self.start_time
        memory_usage = self.process.memory_info().rss / 1024 / 1024  # MB
        cpu_usage = self.process.cpu_percent()

        metrics = BenchmarkMetrics(
            execution_time=execution_time,
            memory_usage=memory_usage,
            cpu_usage=cpu_usage,
            api_calls=0,  # To be set by track_api_calls decorator
            success_rate=0,  # To be calculated
            error_count=0,  # To be set by track_errors decorator
            throughput=0  # To be calculated
        )

        self.metrics_history.append(metrics)
        self.logger.info(f"Benchmark completed: {execution_time:.2f}s, {memory_usage:.1f}MB RAM")
        return metrics

    def benchmark_function(self, func: Callable) -> Callable:
        """Decorator to benchmark a function"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            self.start_benchmark()
            start_memory = self.process.memory_info().rss / 1024 / 1024

            try:
                result = func(*args, **kwargs)
                metrics = self.end_benchmark()

                # Calculate additional metrics
                end_memory = self.process.memory_info().rss / 1024 / 1024
                metrics.memory_usage = end_memory - start_memory
                metrics.throughput = 1 / metrics.execution_time if metrics.execution_time > 0 else 0

                return result, metrics
            except Exception as e:
                self.logger.error(f"Function {func.__name__} failed: {e}")
                metrics = self.end_benchmark()
                metrics.error_count = 1
                raise

        return wrapper

    def compare_algorithms(self, algorithms: Dict[str, Callable], test_data: Any) -> pd.DataFrame:
        """Compare multiple algorithms against the same test data"""
        results = []

        for name, algorithm in algorithms.items():
            self.logger.info(f"Testing {name}...")

            # Reset metrics for each algorithm
            self.algorithm_name = name
            self.metrics_history = []

            try:
                # Benchmark the algorithm
                start_time = time.time()
                result = algorithm(test_data)
                end_time = time.time()

                # Get system metrics
                memory_usage = self.process.memory_info().rss / 1024 / 1024
                cpu_usage = self.process.cpu_percent()

                results.append({
                    'algorithm': name,
                    'execution_time': end_time - start_time,
                    'memory_usage': memory_usage,
                    'cpu_usage': cpu_usage,
                    'success': True,
                    'result_size': len(str(result)) if result else 0
                })

            except Exception as e:
                self.logger.error(f"Algorithm {name} failed: {e}")
                results.append({
                    'algorithm': name,
                    'execution_time': float('inf'),
                    'memory_usage': float('inf'),
                    'cpu_usage': float('inf'),
                    'success': False,
                    'result_size': 0
                })

        return pd.DataFrame(results)

    def generate_performance_report(self, output_file: str = None) -> Dict:
        """Generate comprehensive performance report"""
        if not self.metrics_history:
            return {"error": "No benchmark data available"}

        # Calculate statistics
        execution_times = [m.execution_time for m in self.metrics_history]
        memory_usage = [m.memory_usage for m in self.metrics_history]
        cpu_usage = [m.cpu_usage for m in self.metrics_history]

        report = {
            "algorithm": self.algorithm_name,
            "benchmark_date": datetime.now().isoformat(),
            "statistics": {
                "execution_time": {
                    "mean": np.mean(execution_times),
                    "median": np.median(execution_times),
                    "std": np.std(execution_times),
                    "min": np.min(execution_times),
                    "max": np.max(execution_times)
                },
                "memory_usage": {
                    "mean": np.mean(memory_usage),
                    "median": np.median(memory_usage),
                    "std": np.std(memory_usage),
                    "min": np.min(memory_usage),
                    "max": np.max(memory_usage)
                },
                "cpu_usage": {
                    "mean": np.mean(cpu_usage),
                    "median": np.median(cpu_usage),
                    "std": np.std(cpu_usage),
                    "min": np.min(cpu_usage),
                    "max": np.max(cpu_usage)
                },
                "total_runs": len(self.metrics_history)
            },
            "optimization_suggestions": self._generate_optimization_suggestions()
        }

        if output_file:
            with open(output_file, 'w') as f:
                json.dump(report, f, indent=2)

        return report

    def _generate_optimization_suggestions(self) -> List[str]:
        """Generate optimization suggestions based on performance data"""
        suggestions = []

        if not self.metrics_history:
            return suggestions

        avg_execution_time = np.mean([m.execution_time for m in self.metrics_history])
        avg_memory_usage = np.mean([m.memory_usage for m in self.metrics_history])
        avg_cpu_usage = np.mean([m.cpu_usage for m in self.metrics_history])

        # Execution time suggestions
        if avg_execution_time > 5.0:
            suggestions.append("Consider optimizing API calls with parallel processing")
            suggestions.append("Implement caching for frequently accessed data")

        if avg_execution_time > 10.0:
            suggestions.append("Review algorithm for computational bottlenecks")
            suggestions.append("Consider using more efficient data structures")

        # Memory usage suggestions
        if avg_memory_usage > 100:
            suggestions.append("Implement memory pooling for DataFrame operations")
            suggestions.append("Review for potential memory leaks")

        if avg_memory_usage > 500:
            suggestions.append("Consider streaming large datasets instead of loading into memory")

        # CPU usage suggestions
        if avg_cpu_usage > 80:
            suggestions.append("Optimize algorithm for lower CPU usage")
            suggestions.append("Consider using NumPy/Pandas vectorization")

        if avg_cpu_usage > 90:
            suggestions.append("Profile function calls for optimization opportunities")

        return suggestions

    def plot_performance_comparison(self, comparison_df: pd.DataFrame, save_path: str = None):
        """Create visual comparison of algorithm performance"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle('Algorithm Performance Comparison', fontsize=16)

        # Execution Time Comparison
        axes[0, 0].bar(comparison_df['algorithm'], comparison_df['execution_time'])
        axes[0, 0].set_title('Execution Time (seconds)')
        axes[0, 0].set_ylabel('Time (s)')
        axes[0, 0].tick_params(axis='x', rotation=45)

        # Memory Usage Comparison
        axes[0, 1].bar(comparison_df['algorithm'], comparison_df['memory_usage'])
        axes[0, 1].set_title('Memory Usage (MB)')
        axes[0, 1].set_ylabel('Memory (MB)')
        axes[0, 1].tick_params(axis='x', rotation=45)

        # CPU Usage Comparison
        axes[1, 0].bar(comparison_df['algorithm'], comparison_df['cpu_usage'])
        axes[1, 0].set_title('CPU Usage (%)')
        axes[1, 0].set_ylabel('CPU %')
        axes[1, 0].tick_params(axis='x', rotation=45)

        # Success Rate
        success_data = comparison_df.groupby('algorithm')['success'].mean() * 100
        axes[1, 1].bar(success_data.index, success_data.values)
        axes[1, 1].set_title('Success Rate (%)')
        axes[1, 1].set_ylabel('Success %')
        axes[1, 1].tick_params(axis='x', rotation=45)

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')

        plt.show()

# API Call Tracker
class APICallTracker:
    """Track API calls and optimize based on patterns"""

    def __init__(self):
        self.call_counts = {}
        self.call_times = {}
        self.duplicate_calls = 0

    def track_call(self, api_name: str, params: Dict):
        """Track an API call"""
        call_key = f"{api_name}_{str(sorted(params.items()))}"

        if call_key in self.call_counts:
            self.duplicate_calls += 1
            self.logger.warning(f"Duplicate API call detected: {api_name}")

        self.call_counts[call_key] = self.call_counts.get(call_key, 0) + 1
        self.call_times[call_key] = time.time()

    def get_optimization_suggestions(self) -> List[str]:
        """Get suggestions based on API call patterns"""
        suggestions = []

        # Find most called APIs
        if self.call_counts:
            sorted_calls = sorted(self.call_counts.items(), key=lambda x: x[1], reverse=True)
            top_api = sorted_calls[0]

            if top_api[1] > 10:  # Called more than 10 times
                suggestions.append(f"Consider caching {top_api[0]} (called {top_api[1]} times)")

        if self.duplicate_calls > 0:
            suggestions.append(f"Eliminate {self.duplicate_calls} duplicate API calls through batching")

        return suggestions

# Memory Profiler
class MemoryProfiler:
    """Profile memory usage patterns"""

    def __init__(self):
        self.snapshots = []
        self.peak_memory = 0

    def take_snapshot(self, label: str = ""):
        """Take a memory snapshot"""
        import tracemalloc

        if not tracemalloc.is_tracing():
            tracemalloc.start()

        current, peak = tracemalloc.get_traced_memory()
        snapshot = {
            'label': label,
            'current': current / 1024 / 1024,  # MB
            'peak': peak / 1024 / 1024,  # MB
            'timestamp': time.time()
        }

        self.snapshots.append(snapshot)
        self.peak_memory = max(self.peak_memory, peak / 1024 / 1024)

        return snapshot

    def generate_memory_report(self) -> Dict:
        """Generate memory usage report"""
        if not self.snapshots:
            return {"error": "No memory snapshots available"}

        current_memory = [s['current'] for s in self.snapshots]
        peak_memory = [s['peak'] for s in self.snapshots]

        return {
            "peak_memory_usage": max(peak_memory),
            "average_memory_usage": np.mean(current_memory),
            "memory_growth": current_memory[-1] - current_memory[0] if len(current_memory) > 1 else 0,
            "snapshots": len(self.snapshots),
            "potential_leaks": current_memory[-1] > current_memory[0] * 1.5 if len(current_memory) > 1 else False
        }

# Real-time Performance Monitor
class RealTimeMonitor:
    """Monitor performance metrics in real-time"""

    def __init__(self, update_interval: float = 1.0):
        self.update_interval = update_interval
        self.monitoring = False
        self.metrics = []
        self.process = psutil.Process()

    def start_monitoring(self):
        """Start real-time monitoring"""
        self.monitoring = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop)
        self.monitor_thread.daemon = True
        self.monitor_thread.start()

    def stop_monitoring(self):
        """Stop real-time monitoring"""
        self.monitoring = False
        if hasattr(self, 'monitor_thread'):
            self.monitor_thread.join()

    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.monitoring:
            metrics = {
                'timestamp': time.time(),
                'cpu_percent': self.process.cpu_percent(),
                'memory_percent': self.process.memory_percent(),
                'memory_mb': self.process.memory_info().rss / 1024 / 1024,
                'num_threads': self.process.num_threads()
            }

            self.metrics.append(metrics)
            time.sleep(self.update_interval)

    def get_metrics_summary(self) -> Dict:
        """Get summary of collected metrics"""
        if not self.metrics:
            return {}

        cpu_values = [m['cpu_percent'] for m in self.metrics]
        memory_values = [m['memory_mb'] for m in self.metrics]

        return {
            'duration': self.metrics[-1]['timestamp'] - self.metrics[0]['timestamp'],
            'avg_cpu': np.mean(cpu_values),
            'max_cpu': np.max(cpu_values),
            'avg_memory': np.mean(memory_values),
            'max_memory': np.max(memory_values),
            'samples': len(self.metrics)
        }

# Example usage
def example_benchmark():
    """Example of how to use the performance benchmark"""

    # Sample algorithms to compare
    def naive_market_making(data):
        """Simulate naive market making algorithm"""
        time.sleep(2)  # Simulate processing time
        return {"orders": ["buy", "sell"], "status": "completed"}

    def optimized_market_making(data):
        """Simulate optimized market making algorithm"""
        time.sleep(0.5)  # Simulate faster processing
        return {"orders": ["buy", "sell"], "status": "completed"}

    # Initialize benchmark
    benchmark = PerformanceBenchmark("market_making_comparison")

    # Compare algorithms
    algorithms = {
        "naive": naive_market_making,
        "optimized": optimized_market_making
    }

    test_data = {"symbol": "BTCUSD", "price": 50000}
    comparison_df = benchmark.compare_algorithms(algorithms, test_data)

    # Generate report
    report = benchmark.generate_performance_report("performance_report.json")

    # Create visualization
    benchmark.plot_performance_comparison(comparison_df, "performance_comparison.png")

    print("Benchmark completed. Check the generated files for results.")

if __name__ == "__main__":
    example_benchmark()