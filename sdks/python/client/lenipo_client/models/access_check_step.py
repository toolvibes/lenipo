from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.access_check_step_params import AccessCheckStepParams





T = TypeVar("T", bound="AccessCheckStep")



@_attrs_define
class AccessCheckStep:
    """ 
        Attributes:
            code (str):
            passed (bool | None):
            params (AccessCheckStepParams):
     """

    code: str
    passed: bool | None
    params: AccessCheckStepParams





    def to_dict(self) -> dict[str, Any]:
        from ..models.access_check_step_params import AccessCheckStepParams # noqa: PLC0415
        code = self.code

        passed: bool | None
        passed = self.passed

        params = self.params.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "code": code,
            "passed": passed,
            "params": params,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.access_check_step_params import AccessCheckStepParams # noqa: PLC0415
        d = dict(src_dict)
        code = d.pop("code")

        def _parse_passed(data: object) -> bool | None:
            if data is None:
                return data
            return cast(bool | None, data)

        passed = _parse_passed(d.pop("passed"))


        params = AccessCheckStepParams.from_dict(d.pop("params"))




        access_check_step = cls(
            code=code,
            passed=passed,
            params=params,
        )

        return access_check_step

