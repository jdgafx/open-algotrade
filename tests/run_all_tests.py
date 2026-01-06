#!/usr/bin/env python3
"""
Comprehensive Test Execution Script

This script runs all trading system tests including:
- Unit tests for all strategies and components
- Integration tests for APIs and data feeds
- Stress tests for market scenarios
- Performance benchmarks
- Coverage reports
- Deployment readiness validation

Usage: python run_all_tests.py [--strategy STRATEGY] [--verbose] [--coverage]
"""

import os
import sys
import unittest
import subprocess
import time
import json
from datetime import datetime
from pathlib import Path
import argparse
import logging

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Import our testing modules
from tests.stress.test_market_scenarios import MarketStressTester, StressTestDataGenerator
from src.testing.test_framework import TradingSystemTester, TestConfig

class TestRunner:
    """Main test execution orchestrator"""

    def __init__(self, verbose: bool = False, coverage: bool = False, specific_strategy: str = None):
        self.verbose = verbose
        self.coverage = coverage
        self.specific_strategy = specific_strategy
        self.results = {
            'start_time': datetime.now().isoformat(),
            'unit_tests': {},
            'integration_tests': {},
            'stress_tests': {},
            'performance_tests': {},
            'coverage': {},
            'overall_status': 'PENDING'
        }
        self.setup_logging()

    def setup_logging(self):
        """Setup logging configuration"""
        level = logging.DEBUG if self.verbose else logging.INFO
        logging.basicConfig(
            level=level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler(f'test_execution_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
            ]
        )
        self.logger = logging.getLogger(__name__)

    def run_unit_tests(self) -> dict:
        """Run all unit tests"""
        self.logger.info("🔬 Starting Unit Tests...")

        loader = unittest.TestLoader()
        start_dir = os.path.join(os.path.dirname(__file__), 'unit')
        suite = loader.discover(start_dir, pattern='test_*.py')

        runner = unittest.TextTestRunner(
            verbosity=2 if self.verbose else 1,
            stream=sys.stdout,
            buffer=True
        )

        result = runner.run(suite)

        unit_test_results = {
            'tests_run': result.testsRun,
            'failures': len(result.failures),
            'errors': len(result.errors),
            'skipped': len(result.skipped),
            'success_rate': (result.testsRun - len(result.failures) - len(result.errors)) / max(result.testsRun, 1) * 100,
            'status': 'PASSED' if result.wasSuccessful() else 'FAILED',
            'failure_details': [
                {'test': str(test), 'error': error}
                for test, error in result.failures + result.errors
            ]
        }

        self.logger.info(f"Unit Tests Complete: {unit_test_results['status']}")
        return unit_test_results

    def run_integration_tests(self) -> dict:
        """Run all integration tests"""
        self.logger.info("🔌 Starting Integration Tests...")

        loader = unittest.TestLoader()
        start_dir = os.path.join(os.path.dirname(__file__), 'integration')
        suite = loader.discover(start_dir, pattern='test_*.py')

        runner = unittest.TextTestRunner(
            verbosity=2 if self.verbose else 1,
            stream=sys.stdout,
            buffer=True
        )

        result = runner.run(suite)

        integration_test_results = {
            'tests_run': result.testsRun,
            'failures': len(result.failures),
            'errors': len(result.errors),
            'skipped': len(result.skipped),
            'success_rate': (result.testsRun - len(result.failures) - len(result.errors)) / max(result.testsRun, 1) * 100,
            'status': 'PASSED' if result.wasSuccessful() else 'FAILED',
            'failure_details': [
                {'test': str(test), 'error': error}
                for test, error in result.failures + result.errors
            ]
        }

        self.logger.info(f"Integration Tests Complete: {integration_test_results['status']}")
        return integration_test_results

    def run_stress_tests(self) -> dict:
        """Run stress tests on trading strategies"""
        self.logger.info("💪 Starting Stress Tests...")

        try:
            stress_tester = MarketStressTester()

            # Import strategies (would use actual implementations)
            from src.strategies.sma_strategy import SMAStrategy
            from src.strategies.rsi_strategy import RSIStrategy
            from src.strategies.vwap_strategy import VWAPStrategy
            from src.strategies.market_maker import MarketMakerStrategy

            strategies = {
                'sma': SMAStrategy(),
                'rsi': RSIStrategy(),
                'vwap': VWAPStrategy(),
                'market_maker': MarketMakerStrategy()
            }

            # Filter for specific strategy if requested
            if self.specific_strategy and self.specific_strategy in strategies:
                strategies = {self.specific_strategy: strategies[self.specific_strategy]}

            stress_results = stress_tester.run_stress_tests(strategies)

            # Calculate summary metrics
            total_scenarios = sum(len(scenarios) for scenarios in stress_results.values())
            survived_scenarios = sum(
                sum(1 for scenario_result in scenarios.values()
                    if scenario_result.get('survived', False))
                for scenarios in stress_results.values()
            )

            stress_test_results = {
                'strategies_tested': list(strategies.keys()),
                'total_scenarios': total_scenarios,
                'survived_scenarios': survived_scenarios,
                'survival_rate': (survived_scenarios / total_scenarios * 100) if total_scenarios > 0 else 0,
                'status': 'PASSED' if survived_scenarios >= total_scenarios * 0.8 else 'FAILED',
                'detailed_results': stress_results
            }

            # Generate stress test report
            report = stress_tester.generate_stress_test_report()
            report_path = f'stress_test_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
            with open(report_path, 'w') as f:
                f.write(report)

            stress_test_results['report_path'] = report_path

            self.logger.info(f"Stress Tests Complete: {stress_test_results['status']}")
            return stress_test_results

        except Exception as e:
            self.logger.error(f"Stress test execution failed: {str(e)}")
            return {
                'status': 'ERROR',
                'error': str(e),
                'strategies_tested': [],
                'total_scenarios': 0,
                'survived_scenarios': 0
            }

    def run_performance_tests(self) -> dict:
        """Run performance benchmarks"""
        self.logger.info("⚡ Starting Performance Tests...")

        try:
            config = TestConfig(
                initial_capital=100000.0,
                test_symbols=["BTC/USDT", "ETH/USDT"],
                start_date=datetime(2023, 1, 1),
                end_date=datetime(2023, 12, 31)
            )

            tester = TradingSystemTester(config)

            # Run performance tests
            import asyncio
            performance_results = asyncio.run(tester.run_comprehensive_tests())

            # Calculate performance metrics
            perf_metrics = {
                'status': 'PASSED',
                'strategies_tested': len(performance_results.get('backtest_results', {})),
                'backtests_completed': len(performance_results.get('backtest_results', {})),
                'paper_trading_completed': bool(performance_results.get('paper_trading')),
                'risk_validation_passed': performance_results.get('risk_validation', {}).get('position_sizing', False),
                'detailed_results': performance_results
            }

            # Generate performance report
            report = tester.generate_test_report(performance_results)
            report_path = f'performance_test_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
            with open(report_path, 'w') as f:
                f.write(report)

            perf_metrics['report_path'] = report_path

            self.logger.info(f"Performance Tests Complete: {perf_metrics['status']}")
            return perf_metrics

        except Exception as e:
            self.logger.error(f"Performance test execution failed: {str(e)}")
            return {
                'status': 'ERROR',
                'error': str(e),
                'strategies_tested': 0,
                'backtests_completed': 0
            }

    def run_coverage_analysis(self) -> dict:
        """Run code coverage analysis"""
        self.logger.info("📊 Starting Coverage Analysis...")

        if not self.coverage:
            return {'status': 'SKIPPED', 'message': 'Coverage analysis not requested'}

        try:
            # Run coverage using coverage.py
            coverage_cmd = [
                'python', '-m', 'coverage', 'run',
                '--source=src',
                '--omit=*/tests/*,*/venv/*,*/__pycache__/*',
                '-m', 'unittest', 'discover', 'tests', '-v'
            ]

            result = subprocess.run(
                coverage_cmd,
                capture_output=True,
                text=True,
                cwd=str(project_root)
            )

            # Generate coverage report
            report_cmd = ['python', '-m', 'coverage', 'report', '--format=json']
            report_result = subprocess.run(
                report_cmd,
                capture_output=True,
                text=True,
                cwd=str(project_root)
            )

            if report_result.returncode == 0:
                coverage_data = json.loads(report_result.stdout)
                total_coverage = coverage_data.get('totals', {}).get('percent_covered', 0)

                coverage_results = {
                    'status': 'PASSED' if total_coverage >= 80 else 'FAILED',
                    'total_coverage': total_coverage,
                    'lines_covered': coverage_data.get('totals', {}).get('covered_lines', 0),
                    'lines_missing': coverage_data.get('totals', {}).get('missing_lines', 0),
                    'num_statements': coverage_data.get('totals', {}).get('num_statements', 0)
                }

                # Generate HTML report
                html_cmd = ['python', '-m', 'coverage', 'html', '-d', 'htmlcov']
                subprocess.run(html_cmd, cwd=str(project_root))
                coverage_results['html_report_path'] = 'htmlcov/index.html'

                self.logger.info(f"Coverage Analysis Complete: {total_coverage:.1f}%")
                return coverage_results
            else:
                self.logger.error("Coverage report generation failed")
                return {
                    'status': 'ERROR',
                    'error': 'Failed to generate coverage report'
                }

        except Exception as e:
            self.logger.error(f"Coverage analysis failed: {str(e)}")
            return {
                'status': 'ERROR',
                'error': str(e)
            }

    def check_deployment_readiness(self) -> dict:
        """Check deployment readiness based on test results"""
        self.logger.info("🚀 Checking Deployment Readiness...")

        # Check if all critical tests passed
        unit_passed = self.results.get('unit_tests', {}).get('status') == 'PASSED'
        integration_passed = self.results.get('integration_tests', {}).get('status') == 'PASSED'
        stress_passed = self.results.get('stress_tests', {}).get('status') == 'PASSED'
        coverage_adequate = self.results.get('coverage', {}).get('total_coverage', 0) >= 80

        # Critical requirements
        critical_requirements = [
            ('Unit Tests', unit_passed),
            ('Integration Tests', integration_passed),
            ('Stress Tests', stress_passed)
        ]

        all_critical_passed = all(status for _, status in critical_requirements)

        deployment_readiness = {
            'ready_for_deployment': all_critical_passed and coverage_adequate,
            'critical_requirements': [
                {'requirement': name, 'status': 'PASSED' if status else 'FAILED'}
                for name, status in critical_requirements
            ],
            'coverage_adequate': coverage_adequate,
            'recommendations': []
        }

        # Add recommendations
        if not unit_passed:
            deployment_readiness['recommendations'].append("Fix failing unit tests before deployment")

        if not integration_passed:
            deployment_readiness['recommendations'].append("Resolve integration test failures before deployment")

        if not stress_passed:
            deployment_readiness['recommendations'].append("Address stress test failures before deployment")

        if not coverage_adequate:
            deployment_readiness['recommendations'].append("Increase test coverage to at least 80% before deployment")

        if deployment_readiness['ready_for_deployment']:
            deployment_readiness['recommendations'].append("✅ All critical requirements met - Ready for deployment")
        else:
            deployment_readiness['recommendations'].append("❌ Critical requirements not met - Do NOT deploy")

        self.logger.info(f"Deployment Readiness: {'READY' if deployment_readiness['ready_for_deployment'] else 'NOT READY'}")
        return deployment_readiness

    def generate_final_report(self) -> str:
        """Generate comprehensive final test report"""
        report = []
        report.append("=" * 80)
        report.append("COMPREHENSIVE TRADING SYSTEM TEST REPORT")
        report.append("=" * 80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Duration: {self._calculate_duration()}")
        report.append("")

        # Executive Summary
        report.append("EXECUTIVE SUMMARY")
        report.append("-" * 40)

        deployment_ready = self.results.get('deployment_readiness', {}).get('ready_for_deployment', False)
        report.append(f"Overall Status: {'✅ READY FOR DEPLOYMENT' if deployment_ready else '❌ NOT READY FOR DEPLOYMENT'}")
        report.append("")

        # Test Results Summary
        report.append("TEST RESULTS SUMMARY")
        report.append("-" * 40)

        test_categories = [
            ('Unit Tests', self.results.get('unit_tests', {})),
            ('Integration Tests', self.results.get('integration_tests', {})),
            ('Stress Tests', self.results.get('stress_tests', {})),
            ('Performance Tests', self.results.get('performance_tests', {})),
            ('Coverage Analysis', self.results.get('coverage', {}))
        ]

        for category_name, category_results in test_categories:
            if category_results:
                status = category_results.get('status', 'UNKNOWN')
                icon = "✅" if status == 'PASSED' else "❌" if status == 'FAILED' else "⚠️"
                report.append(f"{icon} {category_name}: {status}")

                if category_name == 'Unit Tests':
                    report.append(f"   Tests Run: {category_results.get('tests_run', 0)}")
                    report.append(f"   Success Rate: {category_results.get('success_rate', 0):.1f}%")
                elif category_name == 'Coverage Analysis':
                    report.append(f"   Coverage: {category_results.get('total_coverage', 0):.1f}%")
                elif category_name == 'Stress Tests':
                    report.append(f"   Survival Rate: {category_results.get('survival_rate', 0):.1f}%")

                report.append("")

        # Detailed Results
        report.append("DETAILED RESULTS")
        report.append("-" * 40)

        for category_name, category_results in test_categories:
            if category_results and category_results.get('failure_details'):
                report.append(f"\n{category_name} Failures:")
                for failure in category_results['failure_details'][:5]:  # Limit to first 5 failures
                    report.append(f"  - {failure['test']}")
                    if self.verbose:
                        report.append(f"    Error: {failure['error'][:200]}...")

        # Deployment Readiness
        if 'deployment_readiness' in self.results:
            deployment = self.results['deployment_readiness']
            report.append("\nDEPLOYMENT READINESS")
            report.append("-" * 40)
            report.append(f"Ready for Deployment: {'YES' if deployment['ready_for_deployment'] else 'NO'}")

            for requirement in deployment.get('critical_requirements', []):
                status_icon = "✅" if requirement['status'] == 'PASSED' else "❌"
                report.append(f"{status_icon} {requirement['requirement']}: {requirement['status']}")

            if deployment['recommendations']:
                report.append("\nRecommendations:")
                for rec in deployment['recommendations']:
                    report.append(f"  • {rec}")

        # Report Files
        report.append("\nGENERATED REPORTS")
        report.append("-" * 40)

        report_files = []
        for category, category_results in self.results.items():
            if isinstance(category_results, dict) and category_results.get('report_path'):
                report_files.append(f"{category.replace('_', ' ').title()}: {category_results['report_path']}")

        if report_files:
            for report_file in report_files:
                report.append(f"  📄 {report_file}")

        report.append("\n" + "=" * 80)
        report.append("END OF REPORT")

        return "\n".join(report)

    def _calculate_duration(self) -> str:
        """Calculate test execution duration"""
        start_time = datetime.fromisoformat(self.results['start_time'])
        end_time = datetime.now()
        duration = end_time - start_time

        hours = duration.seconds // 3600
        minutes = (duration.seconds % 3600) // 60
        seconds = duration.seconds % 60

        if hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s"

    def run_all_tests(self) -> dict:
        """Run all test categories"""
        self.logger.info("🚀 Starting Comprehensive Test Suite...")

        try:
            # Run unit tests
            self.results['unit_tests'] = self.run_unit_tests()

            # Run integration tests
            self.results['integration_tests'] = self.run_integration_tests()

            # Run stress tests
            self.results['stress_tests'] = self.run_stress_tests()

            # Run performance tests
            self.results['performance_tests'] = self.run_performance_tests()

            # Run coverage analysis
            self.results['coverage'] = self.run_coverage_analysis()

            # Check deployment readiness
            self.results['deployment_readiness'] = self.check_deployment_readiness()

            # Generate final report
            final_report = self.generate_final_report()
            report_path = f'final_test_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
            with open(report_path, 'w') as f:
                f.write(final_report)

            self.results['final_report_path'] = report_path
            self.results['end_time'] = datetime.now().isoformat()
            self.results['overall_status'] = 'COMPLETED'

            # Print final summary
            print("\n" + "=" * 80)
            print("TEST EXECUTION COMPLETE")
            print("=" * 80)
            print(f"Final Report: {report_path}")
            print("=" * 80)

            return self.results

        except Exception as e:
            self.logger.error(f"Test execution failed: {str(e)}")
            self.results['overall_status'] = 'ERROR'
            self.results['error'] = str(e)
            return self.results

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Run comprehensive trading system tests')
    parser.add_argument('--strategy', help='Run tests for specific strategy only')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--coverage', '-c', action='store_true', help='Run coverage analysis')
    parser.add_argument('--unit-only', action='store_true', help='Run unit tests only')
    parser.add_argument('--integration-only', action='store_true', help='Run integration tests only')
    parser.add_argument('--stress-only', action='store_true', help='Run stress tests only')

    args = parser.parse_args()

    # Create test runner
    runner = TestRunner(
        verbose=args.verbose,
        coverage=args.coverage,
        specific_strategy=args.strategy
    )

    # Run tests based on arguments
    if args.unit_only:
        results = runner.run_unit_tests()
        print(json.dumps(results, indent=2))
    elif args.integration_only:
        results = runner.run_integration_tests()
        print(json.dumps(results, indent=2))
    elif args.stress_only:
        results = runner.run_stress_tests()
        print(json.dumps(results, indent=2))
    else:
        # Run all tests
        results = runner.run_all_tests()

        # Print summary
        print("\nSUMMARY:")
        print(f"Unit Tests: {results.get('unit_tests', {}).get('status', 'UNKNOWN')}")
        print(f"Integration Tests: {results.get('integration_tests', {}).get('status', 'UNKNOWN')}")
        print(f"Stress Tests: {results.get('stress_tests', {}).get('status', 'UNKNOWN')}")
        print(f"Performance Tests: {results.get('performance_tests', {}).get('status', 'UNKNOWN')}")
        print(f"Coverage: {results.get('coverage', {}).get('total_coverage', 0):.1f}%")
        print(f"Deployment Ready: {'YES' if results.get('deployment_readiness', {}).get('ready_for_deployment') else 'NO'}")

    # Exit with appropriate code
    overall_status = results.get('overall_status', 'UNKNOWN')
    if overall_status == 'COMPLETED' and results.get('deployment_readiness', {}).get('ready_for_deployment'):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()