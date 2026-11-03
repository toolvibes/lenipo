from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="JiraImportRequest")



@_attrs_define
class JiraImportRequest:
    """ 
        Attributes:
            url (str):
            token (str):
            project_keys (list[str]):
            dry_run (bool | Unset):  Default: True.
     """

    url: str
    token: str
    project_keys: list[str]
    dry_run: bool | Unset = True
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        url = self.url

        token = self.token

        project_keys = self.project_keys



        dry_run = self.dry_run


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "url": url,
            "token": token,
            "projectKeys": project_keys,
        })
        if dry_run is not UNSET:
            field_dict["dryRun"] = dry_run

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url")

        token = d.pop("token")

        project_keys = cast(list[str], d.pop("projectKeys"))


        dry_run = d.pop("dryRun", UNSET)

        jira_import_request = cls(
            url=url,
            token=token,
            project_keys=project_keys,
            dry_run=dry_run,
        )


        jira_import_request.additional_properties = d
        return jira_import_request

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
