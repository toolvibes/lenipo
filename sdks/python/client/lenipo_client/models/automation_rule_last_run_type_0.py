from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.automation_rule_last_run_type_0_status import AutomationRuleLastRunType0Status
from typing import cast
import datetime






T = TypeVar("T", bound="AutomationRuleLastRunType0")



@_attrs_define
class AutomationRuleLastRunType0:
    """ 
        Attributes:
            at (datetime.datetime):
            status (AutomationRuleLastRunType0Status):
     """

    at: datetime.datetime
    status: AutomationRuleLastRunType0Status





    def to_dict(self) -> dict[str, Any]:
        at = self.at.isoformat()

        status = self.status.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "at": at,
            "status": status,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        at = datetime.datetime.fromisoformat(d.pop("at"))




        status = AutomationRuleLastRunType0Status(d.pop("status"))




        automation_rule_last_run_type_0 = cls(
            at=at,
            status=status,
        )

        return automation_rule_last_run_type_0

