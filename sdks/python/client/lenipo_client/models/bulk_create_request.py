from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.create_issue_request import CreateIssueRequest





T = TypeVar("T", bound="BulkCreateRequest")



@_attrs_define
class BulkCreateRequest:
    """ 
        Attributes:
            issues (list[CreateIssueRequest]):
            atomic (bool | Unset):  Default: False.
     """

    issues: list[CreateIssueRequest]
    atomic: bool | Unset = False
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.create_issue_request import CreateIssueRequest # noqa: PLC0415
        issues = []
        for issues_item_data in self.issues:
            issues_item = issues_item_data.to_dict()
            issues.append(issues_item)



        atomic = self.atomic


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "issues": issues,
        })
        if atomic is not UNSET:
            field_dict["atomic"] = atomic

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.create_issue_request import CreateIssueRequest # noqa: PLC0415
        d = dict(src_dict)
        issues = []
        _issues = d.pop("issues")
        for issues_item_data in (_issues):
            issues_item = CreateIssueRequest.from_dict(issues_item_data)



            issues.append(issues_item)


        atomic = d.pop("atomic", UNSET)

        bulk_create_request = cls(
            issues=issues,
            atomic=atomic,
        )


        bulk_create_request.additional_properties = d
        return bulk_create_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
