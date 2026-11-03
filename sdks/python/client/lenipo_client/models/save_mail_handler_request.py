from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset






T = TypeVar("T", bound="SaveMailHandlerRequest")



@_attrs_define
class SaveMailHandlerRequest:
    """ 
        Attributes:
            host (str):
            username (str):
            issue_type (str):
            enabled (bool | Unset):  Default: True.
            port (int | Unset):  Default: 993.
            secure (bool | Unset):  Default: True.
            password (str | Unset):
            folder (str | Unset):  Default: 'INBOX'.
            done_folder (str | Unset):  Default: ''.
     """

    host: str
    username: str
    issue_type: str
    enabled: bool | Unset = True
    port: int | Unset = 993
    secure: bool | Unset = True
    password: str | Unset = UNSET
    folder: str | Unset = 'INBOX'
    done_folder: str | Unset = ''
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        host = self.host

        username = self.username

        issue_type = self.issue_type

        enabled = self.enabled

        port = self.port

        secure = self.secure

        password = self.password

        folder = self.folder

        done_folder = self.done_folder


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "host": host,
            "username": username,
            "issueType": issue_type,
        })
        if enabled is not UNSET:
            field_dict["enabled"] = enabled
        if port is not UNSET:
            field_dict["port"] = port
        if secure is not UNSET:
            field_dict["secure"] = secure
        if password is not UNSET:
            field_dict["password"] = password
        if folder is not UNSET:
            field_dict["folder"] = folder
        if done_folder is not UNSET:
            field_dict["doneFolder"] = done_folder

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        host = d.pop("host")

        username = d.pop("username")

        issue_type = d.pop("issueType")

        enabled = d.pop("enabled", UNSET)

        port = d.pop("port", UNSET)

        secure = d.pop("secure", UNSET)

        password = d.pop("password", UNSET)

        folder = d.pop("folder", UNSET)

        done_folder = d.pop("doneFolder", UNSET)

        save_mail_handler_request = cls(
            host=host,
            username=username,
            issue_type=issue_type,
            enabled=enabled,
            port=port,
            secure=secure,
            password=password,
            folder=folder,
            done_folder=done_folder,
        )


        save_mail_handler_request.additional_properties = d
        return save_mail_handler_request

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
