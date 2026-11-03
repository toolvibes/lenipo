from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.presence_state import PresenceState
from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="UpdatePresenceRequest")



@_attrs_define
class UpdatePresenceRequest:
    """ 
        Attributes:
            state (PresenceState):
            issue_key (None | str | Unset):
            branch (None | str | Unset):
            note (str | Unset):
     """

    state: PresenceState
    issue_key: None | str | Unset = UNSET
    branch: None | str | Unset = UNSET
    note: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        state = self.state.value

        issue_key: None | str | Unset
        if isinstance(self.issue_key, Unset):
            issue_key = UNSET
        else:
            issue_key = self.issue_key

        branch: None | str | Unset
        if isinstance(self.branch, Unset):
            branch = UNSET
        else:
            branch = self.branch

        note = self.note


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "state": state,
        })
        if issue_key is not UNSET:
            field_dict["issueKey"] = issue_key
        if branch is not UNSET:
            field_dict["branch"] = branch
        if note is not UNSET:
            field_dict["note"] = note

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        state = PresenceState(d.pop("state"))




        def _parse_issue_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        issue_key = _parse_issue_key(d.pop("issueKey", UNSET))


        def _parse_branch(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        branch = _parse_branch(d.pop("branch", UNSET))


        note = d.pop("note", UNSET)

        update_presence_request = cls(
            state=state,
            issue_key=issue_key,
            branch=branch,
            note=note,
        )


        update_presence_request.additional_properties = d
        return update_presence_request

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
